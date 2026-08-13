"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

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

export async function submitAssessmentAction(
  assessmentId: string,
  answers: Record<string, number | null>,
  autoSubmitted: boolean
) {
  const user = await requireUser();
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: true },
  });
  if (!assessment || assessment.learnerId !== user.id || assessment.status !== "IN_PROGRESS") {
    return { ok: false };
  }

  let score = 0;
  await prisma.$transaction(
    assessment.questions.map((q) => {
      const selected = answers[q.id];
      const selectedIndex = typeof selected === "number" && selected >= 0 && selected <= 3 ? selected : null;
      if (selectedIndex !== null && selectedIndex === q.correctIndex) score++;
      return prisma.assessmentQuestion.update({ where: { id: q.id }, data: { selectedIndex } });
    })
  );

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: "SUBMITTED", submittedAt: new Date(), score, autoSubmitted },
  });

  revalidatePath("/assessment");
  revalidatePath(`/admin/learners/${user.id}`);
  return { ok: true, score, total: assessment.questions.length };
}
