"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordResult, SYSTEM_ACTOR } from "@/lib/results";
import { CERTIFICATE_PASS_SCORE } from "@/lib/certificate";

export async function startAssessmentAction(assessmentId: string) {
  const user = await requireUser();
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment || assessment.learnerId !== user.id || assessment.status !== "ASSIGNED") return;

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + assessment.durationMinutes * 60_000);

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: "IN_PROGRESS", startedAt, expiresAt },
  });

  revalidatePath("/assessment");
}

export async function logAssessmentEventAction(assessmentId: string, type: string) {
  const user = await requireUser();
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment || assessment.learnerId !== user.id || assessment.status !== "IN_PROGRESS") return;

  await prisma.assessmentEvent.create({ data: { assessmentId, type } });
}

export type SubmitResult =
  | { ok: true; score: number; total: number; alreadySubmitted: boolean }
  | { ok: false };

/**
 * Grade and close an assessment. Safe to call more than once.
 *
 * There are three callers that can fire at nearly the same moment: the
 * learner clicking Submit, the countdown hitting zero, and the anti-cheat
 * violation limit tripping — plus the server-side expiry sweep on
 * /assessment. A dropped connection and a retry adds a fourth.
 *
 * The status transition is therefore claimed with a single conditional
 * UPDATE ... WHERE status = 'IN_PROGRESS'. Exactly one caller can match and
 * change that row; every other caller sees count === 0 and returns the
 * result that the winner recorded, rather than grading a second time or
 * raising an error. Reading the status and then updating it in two separate
 * statements — as this did before — leaves a window where two callers both
 * pass the check and both write.
 *
 * The claim and the grading share one transaction, so a failure partway
 * through rolls the claim back and leaves the assessment open rather than
 * stranding it as SUBMITTED with no score.
 */
export async function submitAssessmentAction(
  assessmentId: string,
  answers: Record<string, number | null>,
  autoSubmitted: boolean
): Promise<SubmitResult> {
  const user = await requireUser();

  // Ownership is immutable, so it's safe to check outside the transaction —
  // and it must be checked before any early return that reveals a score,
  // otherwise a learner could read someone else's result by replaying their
  // assessment id against the already-submitted path below.
  const owned = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { learnerId: true },
  });
  if (!owned || owned.learnerId !== user.id) return { ok: false };

  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.assessment.updateMany({
      where: { id: assessmentId, status: "IN_PROGRESS" },
      data: { status: "SUBMITTED", submittedAt: new Date(), autoSubmitted },
    });

    if (claim.count === 0) {
      // Lost the race, or this is a retry of a request that already
      // succeeded. Return what was actually recorded so the caller gets the
      // same answer it would have got the first time.
      const existing = await tx.assessment.findUnique({
        where: { id: assessmentId },
        select: { status: true, score: true, totalQuestions: true },
      });
      if (!existing || existing.status !== "SUBMITTED") return { ok: false } as const;
      return {
        ok: true as const,
        score: existing.score ?? 0,
        total: existing.totalQuestions,
        alreadySubmitted: true,
      };
    }

    const questions = await tx.assessmentQuestion.findMany({ where: { assessmentId } });

    let score = 0;
    for (const q of questions) {
      const selected = answers[q.id];
      const selectedIndex =
        typeof selected === "number" && selected >= 0 && selected <= 3 ? selected : null;
      if (selectedIndex !== null && selectedIndex === q.correctIndex) score++;
      await tx.assessmentQuestion.update({ where: { id: q.id }, data: { selectedIndex } });
    }

    await tx.assessment.update({ where: { id: assessmentId }, data: { score } });

    // Append-only: the score on Assessment is a convenience denormalisation,
    // but AssessmentResult is the record of grade history. A later regrade
    // adds another row pointing at this one rather than editing it.
    await recordResult(tx, {
      assessmentId,
      score,
      totalQuestions: questions.length,
      passScore: CERTIFICATE_PASS_SCORE,
      reason: autoSubmitted ? "Auto-graded on timeout or violation limit" : "Auto-graded on submit",
      recordedByEmail: SYSTEM_ACTOR,
    });

    return { ok: true as const, score, total: questions.length, alreadySubmitted: false };
  });

  revalidatePath("/assessment");
  revalidatePath(`/admin/learners/${user.id}`);
  return result;
}
