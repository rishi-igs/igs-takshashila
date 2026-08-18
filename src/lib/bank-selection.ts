import { prisma } from "@/lib/db";
import { resolveBlueprint } from "@/lib/blueprint";
import { PILLAR_LABELS } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";

export type SelectedQuestion = {
  order: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  sourceModuleCode: string;
  questionVersionId: string;
};

export class BankShortfallError extends Error {}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build one candidate's paper from the approved bank, following the
 * blueprint's per-pillar quotas.
 *
 * Two independent randomisations happen here, and they do different jobs:
 *
 *  - *Selection* — which questions this candidate gets. Shuffled per call, so
 *    two candidates sitting the same blueprint see different papers.
 *  - *Presentation* — the order the options appear in. Reshuffled per
 *    candidate rather than reused from the bank row, so even two candidates
 *    who happen to get the same question don't see the same option order.
 *
 * The caller writes the result into AssessmentQuestion, which freezes both.
 *
 * Questions drawn from modules in the learner's own curriculum are preferred;
 * the rest of a quota is topped up from anywhere in that pillar so a narrow
 * curriculum doesn't make a test unbuildable.
 *
 * allowedAssignmentIds narrows "the learner's own curriculum" to a per-learner
 * module restriction when one is set (null means the full designation). A
 * learner whose curriculum was cut down to ten modules should be examined on
 * those, not on the ninety they were never assigned.
 */
export async function selectFromBank(
  designationId: string | null,
  allowedAssignmentIds?: Set<string> | null
): Promise<{ questions: SelectedQuestion[]; blueprintName: string; durationMinutes: number; passScore: number }> {
  const blueprint = await resolveBlueprint(designationId);
  if (!blueprint) {
    throw new BankShortfallError(
      "No assessment blueprint is configured. Create one under Admin → Assessment blueprints, or mark one as the default."
    );
  }
  if (blueprint.items.length === 0) {
    throw new BankShortfallError(
      `Blueprint "${blueprint.name}" has no pillar quotas, so no questions can be selected.`
    );
  }

  // Module codes in this learner's curriculum, used only to prefer relevant
  // questions — never to restrict the pool below what the quota needs.
  const curriculumCodes = designationId
    ? new Set(
        (
          await prisma.assignment.findMany({
            where: {
              designationId,
              ...(allowedAssignmentIds ? { id: { in: [...allowedAssignmentIds] } } : {}),
            },
            select: { moduleCode: true },
          })
        ).map((a) => a.moduleCode)
      )
    : new Set<string>();

  const selected: SelectedQuestion[] = [];
  const shortfalls: string[] = [];

  for (const item of blueprint.items) {
    const pool = await prisma.question.findMany({
      where: { pillar: item.pillar as Pillar, status: "ACTIVE" },
      include: { versions: { where: { isCurrent: true }, take: 1 } },
    });

    const usable = pool.filter((q) => q.versions.length > 0);
    if (usable.length < item.count) {
      shortfalls.push(
        `${PILLAR_LABELS[item.pillar as Pillar]}: needs ${item.count}, bank has ${usable.length} approved`
      );
      continue;
    }

    const preferred = shuffle(usable.filter((q) => q.moduleCode && curriculumCodes.has(q.moduleCode)));
    const rest = shuffle(usable.filter((q) => !q.moduleCode || !curriculumCodes.has(q.moduleCode)));
    const picked = [...preferred, ...rest].slice(0, item.count);

    for (const q of picked) {
      const version = q.versions[0];
      const bankOptions: string[] = JSON.parse(version.optionsJson);
      const correctAnswer = bankOptions[version.correctIndex];
      const shown = shuffle(bankOptions);

      selected.push({
        order: 0, // assigned after all pillars are gathered
        questionText: version.questionText,
        options: shown,
        correctIndex: shown.indexOf(correctAnswer),
        sourceModuleCode: q.moduleCode ?? "—",
        questionVersionId: version.id,
      });
    }
  }

  if (shortfalls.length > 0) {
    throw new BankShortfallError(
      `The question bank can't fill blueprint "${blueprint.name}" — ${shortfalls.join("; ")}. Approve more questions under Admin → Question bank.`
    );
  }

  // Interleave the pillars so the paper doesn't run in predictable blocks.
  const ordered = shuffle(selected).map((q, i) => ({ ...q, order: i + 1 }));

  return {
    questions: ordered,
    blueprintName: blueprint.name,
    durationMinutes: blueprint.durationMinutes,
    passScore: blueprint.passScore,
  };
}
