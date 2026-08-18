"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import {
  createQuestion,
  reviseQuestion,
  setQuestionStatus,
  QuestionValidationError,
  type QuestionDraft,
} from "@/lib/question-bank";
import { generateBankQuestions } from "@/lib/bank-generator";
import { recordResult, currentResult } from "@/lib/results";
import { PILLAR_ORDER } from "@/lib/pillars";
import { CERTIFICATE_PASS_SCORE } from "@/lib/certificate";
import type { Pillar, QuestionStatus } from "@/generated/prisma/enums";

const VALID_STATUSES = new Set(["DRAFT", "ACTIVE", "RETIRED"]);

// Options arrive as option0..optionN so the form can stay a plain
// progressively-enhanced <form> with no client JS.
function readDraft(formData: FormData): QuestionDraft {
  const options: string[] = [];
  for (let i = 0; i < 6; i++) {
    const v = formData.get(`option${i}`);
    if (typeof v === "string" && v.trim()) options.push(v.trim());
  }
  return {
    questionText: String(formData.get("questionText") || ""),
    options,
    correctIndex: parseInt(String(formData.get("correctIndex") ?? "-1"), 10),
    explanation: String(formData.get("explanation") || ""),
  };
}

function backToNew(message: string): never {
  redirect("/admin/questions/new?error=" + encodeURIComponent(message));
}

export async function createQuestionAction(formData: FormData) {
  const admin = await requireAdmin();
  const pillar = String(formData.get("pillar") || "") as Pillar;
  const moduleCode = String(formData.get("moduleCode") || "").trim();
  const status = String(formData.get("status") || "DRAFT");

  if (!pillar) backToNew("Pick a pillar.");
  if (!VALID_STATUSES.has(status)) backToNew("Invalid status.");

  const draft = readDraft(formData);

  let question;
  try {
    question = await createQuestion(
      {
        pillar,
        moduleCode: moduleCode || null,
        status: status as QuestionStatus,
        createdById: admin.id,
        authorEmail: admin.email,
      },
      draft
    );
  } catch (e) {
    if (e instanceof QuestionValidationError) backToNew(e.message);
    throw e;
  }

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.questionCreate,
    entityType: "Question",
    entityId: question.id,
    summary: `Created ${status.toLowerCase()} question in ${pillar} — "${draft.questionText.slice(0, 60)}"`,
    meta: { pillar, moduleCode: moduleCode || null, status },
  });

  revalidatePath("/admin/questions");
  redirect(`/admin/questions/${question.id}?created=1`);
}

export async function reviseQuestionAction(formData: FormData) {
  const admin = await requireAdmin();
  const questionId = String(formData.get("questionId") || "");
  const draft = readDraft(formData);

  let version;
  try {
    version = await reviseQuestion(questionId, draft, admin.email);
  } catch (e) {
    if (e instanceof QuestionValidationError) {
      redirect(`/admin/questions/${questionId}?error=` + encodeURIComponent(e.message));
    }
    throw e;
  }

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.questionRevise,
    entityType: "Question",
    entityId: questionId,
    summary: `Revised question to version ${version.version} — past tests keep the version they were graded against`,
    meta: { version: version.version },
  });

  revalidatePath(`/admin/questions/${questionId}`);
  redirect(`/admin/questions/${questionId}?revised=${version.version}`);
}

export async function setQuestionStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const questionId = String(formData.get("questionId") || "");
  const status = String(formData.get("status") || "");
  if (!VALID_STATUSES.has(status)) {
    redirect(`/admin/questions/${questionId}?error=` + encodeURIComponent("Invalid status."));
  }

  await setQuestionStatus(questionId, status as QuestionStatus);

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.questionStatus,
    entityType: "Question",
    entityId: questionId,
    summary: `Set question status to ${status}`,
    meta: { status },
  });

  revalidatePath("/admin/questions");
  redirect(`/admin/questions/${questionId}?saved=1`);
}

/**
 * Bulk-generate bank questions from the curriculum.
 *
 * Everything lands as DRAFT — generated wording goes in front of nobody until
 * an administrator approves it. Re-running is safe: the unique index on
 * (moduleCode, sourceShape) means existing entries are skipped rather than
 * duplicated, so this doubles as a "top up after adding modules" button.
 */
export async function generateBankAction(formData: FormData) {
  const admin = await requireAdmin();
  const pillarRaw = String(formData.get("pillar") || "").trim();
  const pillar = PILLAR_ORDER.includes(pillarRaw as Pillar) ? (pillarRaw as Pillar) : null;

  const report = await generateBankQuestions({ authorEmail: admin.email, pillar });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.questionGenerate,
    entityType: "Question",
    entityId: null,
    summary: `Generated ${report.created} draft questions from the curriculum${pillar ? ` (${pillar})` : ""} — ${report.skippedExisting} already existed`,
    meta: { ...report, pillar },
  });

  revalidatePath("/admin/questions");
  redirect(
    `/admin/questions?generated=${report.created}&skipped=${report.skippedExisting}&nodistractors=${report.skippedNoDistractors}`
  );
}

/**
 * Approve or retire every question matching a filter in one go — the bank is
 * generated in the hundreds, so per-row clicking is not a usable review flow.
 */
export async function bulkSetStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const status = String(formData.get("status") || "");
  const fromStatus = String(formData.get("fromStatus") || "");
  const pillarRaw = String(formData.get("pillar") || "").trim();

  if (!VALID_STATUSES.has(status)) {
    redirect("/admin/questions?error=" + encodeURIComponent("Invalid target status."));
  }

  const pillar = PILLAR_ORDER.includes(pillarRaw as Pillar) ? (pillarRaw as Pillar) : null;
  const where = {
    ...(pillar ? { pillar } : {}),
    ...(VALID_STATUSES.has(fromStatus) ? { status: fromStatus as QuestionStatus } : {}),
  };

  const { count } = await prisma.question.updateMany({
    where,
    data: { status: status as QuestionStatus },
  });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.questionBulkStatus,
    entityType: "Question",
    entityId: null,
    summary: `Set ${count} ${pillar ?? "bank"} ${count === 1 ? "question" : "questions"} to ${status}${fromStatus ? ` (from ${fromStatus})` : ""}`,
    meta: { count, status, fromStatus: fromStatus || null, pillar },
  });

  revalidatePath("/admin/questions");
  redirect(`/admin/questions?bulk=${count}`);
}

export async function createBlueprintAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const designationId = String(formData.get("designationId") || "").trim();
  const totalQuestions = parseInt(String(formData.get("totalQuestions") || "25"), 10);
  const durationMinutes = parseInt(String(formData.get("durationMinutes") || "20"), 10);
  const passScore = parseInt(String(formData.get("passScore") || "15"), 10);
  const isDefault = formData.get("isDefault") === "on";

  const fail = (m: string): never =>
    redirect("/admin/blueprints/new?error=" + encodeURIComponent(m));

  if (!name) fail("Name is required.");
  if (!Number.isFinite(totalQuestions) || totalQuestions < 1) fail("Total questions must be at least 1.");
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1) fail("Duration must be at least 1 minute.");
  if (!Number.isFinite(passScore) || passScore < 0) fail("Pass score must be zero or more.");

  if (await prisma.assessmentBlueprint.findUnique({ where: { name } })) {
    fail("A blueprint with that name already exists.");
  }

  // Per-pillar quotas arrive as quota_<PILLAR>.
  const items: { pillar: Pillar; count: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("quota_")) continue;
    const count = parseInt(String(value), 10);
    if (Number.isFinite(count) && count > 0) {
      items.push({ pillar: key.slice("quota_".length) as Pillar, count });
    }
  }

  const blueprint = await prisma.$transaction(async (tx) => {
    // Only one blueprint may be default — enforced by a partial unique index,
    // so the incumbent has to be cleared in the same transaction.
    if (isDefault) {
      await tx.assessmentBlueprint.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.assessmentBlueprint.create({
      data: {
        name,
        designationId: designationId || null,
        totalQuestions,
        durationMinutes,
        passScore,
        isDefault,
        items: { create: items },
      },
    });
  });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.blueprintCreate,
    entityType: "AssessmentBlueprint",
    entityId: blueprint.id,
    summary: `Created assessment blueprint "${name}" — ${totalQuestions} questions, ${durationMinutes} min, pass at ${passScore}`,
    meta: { totalQuestions, durationMinutes, passScore, isDefault, quotas: items },
  });

  revalidatePath("/admin/blueprints");
  redirect(`/admin/blueprints?created=1`);
}

/**
 * Re-grade a submitted assessment against the answer key stored in its
 * attempt snapshot, appending a new result record.
 *
 * Nothing is overwritten: the previous record stays exactly as it was and the
 * new one links back to it, so the grade history of a disputed assessment
 * remains fully readable.
 */
export async function regradeAssessmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const assessmentId = String(formData.get("assessmentId") || "");
  const note = String(formData.get("note") || "").trim();

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { questions: true },
  });
  if (!assessment || assessment.status !== "SUBMITTED") {
    redirect(`/admin/learners?error=` + encodeURIComponent("Only a submitted assessment can be regraded."));
  }

  const previous = await currentResult(assessmentId);

  let score = 0;
  for (const q of assessment.questions) {
    if (q.selectedIndex !== null && q.selectedIndex === q.correctIndex) score++;
  }

  const result = await recordResult(prisma, {
    assessmentId,
    score,
    totalQuestions: assessment.questions.length,
    passScore: CERTIFICATE_PASS_SCORE,
    reason: note ? `Regrade: ${note}` : "Regrade",
    recordedByEmail: admin.email,
    supersedesId: previous?.id ?? null,
  });

  await prisma.assessment.update({ where: { id: assessmentId }, data: { score } });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.assessmentRegrade,
    entityType: "Assessment",
    entityId: assessmentId,
    summary:
      previous && previous.score !== score
        ? `Regraded assessment — score changed ${previous.score} → ${score}`
        : `Regraded assessment — score unchanged at ${score}`,
    meta: { previousScore: previous?.score ?? null, newScore: score, resultId: result.id, note: note || null },
  });

  revalidatePath(`/admin/learners/${assessment.learnerId}`);
  redirect(`/admin/learners/${assessment.learnerId}?regraded=1`);
}
