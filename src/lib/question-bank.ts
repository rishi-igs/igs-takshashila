import { prisma } from "@/lib/db";
import type { Pillar, QuestionStatus } from "@/generated/prisma/enums";

export type QuestionDraft = {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string | null;
};

export class QuestionValidationError extends Error {}

/**
 * Validate a draft before it reaches the database. The correct answer is an
 * index into options, so an out-of-range index would silently make a question
 * ungradeable rather than fail loudly.
 */
export function validateDraft(draft: QuestionDraft): void {
  const options = draft.options.map((o) => o.trim()).filter(Boolean);
  if (!draft.questionText.trim()) throw new QuestionValidationError("Question text is required.");
  if (options.length < 2) throw new QuestionValidationError("A question needs at least 2 options.");
  if (options.length > 6) throw new QuestionValidationError("A question can have at most 6 options.");
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    throw new QuestionValidationError("Options must be distinct.");
  }
  if (!Number.isInteger(draft.correctIndex) || draft.correctIndex < 0 || draft.correctIndex >= options.length) {
    throw new QuestionValidationError("Pick which option is the correct answer.");
  }
}

/** Create a brand-new question with its first version. */
export async function createQuestion(
  params: {
    pillar: Pillar;
    moduleCode?: string | null;
    status?: QuestionStatus;
    createdById: string;
    authorEmail: string;
  },
  draft: QuestionDraft
) {
  validateDraft(draft);
  const options = draft.options.map((o) => o.trim()).filter(Boolean);

  return prisma.question.create({
    data: {
      pillar: params.pillar,
      moduleCode: params.moduleCode || null,
      status: params.status ?? "DRAFT",
      createdById: params.createdById,
      versions: {
        create: {
          version: 1,
          questionText: draft.questionText.trim(),
          optionsJson: JSON.stringify(options),
          correctIndex: draft.correctIndex,
          explanation: draft.explanation?.trim() || null,
          authorEmail: params.authorEmail,
          isCurrent: true,
        },
      },
    },
    include: { versions: true },
  });
}

/**
 * Edit a question by appending a new version.
 *
 * The previous version is left byte-for-byte intact and only loses its
 * isCurrent flag — this is the whole point of the bank. Any assessment that
 * was built from the old version still points at it, so past tests are
 * unaffected by the edit. Both writes share a transaction because the
 * partial unique index allows only one current version at a time, so the old
 * flag must drop in the same breath as the new one is set.
 */
export async function reviseQuestion(
  questionId: string,
  draft: QuestionDraft,
  authorEmail: string
) {
  validateDraft(draft);
  const options = draft.options.map((o) => o.trim()).filter(Boolean);

  return prisma.$transaction(async (tx) => {
    const latest = await tx.questionVersion.findFirst({
      where: { questionId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    if (!latest) throw new QuestionValidationError("Question not found.");

    await tx.questionVersion.updateMany({
      where: { questionId, isCurrent: true },
      data: { isCurrent: false },
    });

    return tx.questionVersion.create({
      data: {
        questionId,
        version: latest.version + 1,
        questionText: draft.questionText.trim(),
        optionsJson: JSON.stringify(options),
        correctIndex: draft.correctIndex,
        explanation: draft.explanation?.trim() || null,
        authorEmail,
        isCurrent: true,
      },
    });
  });
}

export async function setQuestionStatus(questionId: string, status: QuestionStatus) {
  return prisma.question.update({ where: { id: questionId }, data: { status } });
}

/** Count of selectable (ACTIVE) bank questions per pillar. */
export async function activeCountsByPillar(): Promise<Record<string, number>> {
  const rows = await prisma.question.groupBy({
    by: ["pillar"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.pillar, r._count._all]));
}
