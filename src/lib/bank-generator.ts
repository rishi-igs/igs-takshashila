import { prisma } from "@/lib/db";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";

/**
 * Bulk-populate the question bank from the curriculum.
 *
 * Three shapes are derivable from a Module on its own. The "hours" shape the
 * per-assessment generator uses is deliberately absent: hours live on
 * Assignment and differ per designation, so an hours question can't be stated
 * correctly by a bank entry that isn't tied to a role.
 *
 * Generation is idempotent — the unique index on (moduleCode, sourceShape)
 * means a second run tops the bank up with newly-added modules rather than
 * duplicating what's already there.
 */
export type BankShape = "topic" | "standard" | "pillar";

export const BANK_SHAPES: BankShape[] = ["topic", "standard", "pillar"];

export type GenerationReport = {
  created: number;
  skippedExisting: number;
  skippedNoDistractors: number;
  byPillar: Record<string, number>;
};

function truncate(text: string, max = 110): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type ModuleRow = {
  code: string;
  name: string;
  pillar: Pillar;
  capabilityTopics: string;
  standard: string;
};

function buildQuestion(
  mod: ModuleRow,
  shape: BankShape,
  siblings: ModuleRow[]
): { questionText: string; options: string[]; correctIndex: number; explanation: string } | null {
  let questionText: string;
  let correctAnswer: string;
  let pool: string[];

  if (shape === "topic") {
    if (!mod.capabilityTopics?.trim()) return null;
    questionText = `Which module covers: "${truncate(mod.capabilityTopics)}"?`;
    correctAnswer = mod.name;
    pool = siblings.map((s) => s.name);
  } else if (shape === "standard") {
    if (!mod.standard?.trim()) return null;
    questionText = `What is the required standard or expectation for "${mod.name}"?`;
    correctAnswer = truncate(mod.standard);
    pool = siblings.filter((s) => s.standard?.trim()).map((s) => truncate(s.standard));
  } else {
    questionText = `Which learning pillar does "${mod.name}" belong to?`;
    correctAnswer = PILLAR_LABELS[mod.pillar];
    pool = PILLAR_ORDER.filter((p) => p !== mod.pillar).map((p) => PILLAR_LABELS[p]);
  }

  const distractors = shuffle(
    Array.from(new Set(pool.filter((d) => d && d !== correctAnswer)))
  ).slice(0, 3);

  // A question with fewer than three plausible wrong answers is not worth
  // banking — it would be guessable by elimination.
  if (distractors.length < 3) return null;

  // Option order is shuffled again per candidate when a test is built, so the
  // order stored here is not the order anyone sits.
  const options = shuffle([correctAnswer, ...distractors]);
  return {
    questionText,
    options,
    correctIndex: options.indexOf(correctAnswer),
    explanation: `Generated from module ${mod.code} (${PILLAR_LABELS[mod.pillar]}).`,
  };
}

export async function generateBankQuestions(params: {
  authorEmail: string;
  pillar?: Pillar | null;
  shapes?: BankShape[];
}): Promise<GenerationReport> {
  const shapes = params.shapes?.length ? params.shapes : BANK_SHAPES;

  const modules = (await prisma.module.findMany({
    where: params.pillar ? { pillar: params.pillar } : {},
    select: { code: true, name: true, pillar: true, capabilityTopics: true, standard: true },
  })) as ModuleRow[];

  // Distractors come from the same pillar so wrong answers stay plausible.
  const byPillar = new Map<Pillar, ModuleRow[]>();
  const allModules = (await prisma.module.findMany({
    select: { code: true, name: true, pillar: true, capabilityTopics: true, standard: true },
  })) as ModuleRow[];
  for (const m of allModules) {
    const list = byPillar.get(m.pillar) ?? [];
    list.push(m);
    byPillar.set(m.pillar, list);
  }

  const existing = new Set(
    (
      await prisma.question.findMany({
        where: { sourceShape: { not: null } },
        select: { moduleCode: true, sourceShape: true },
      })
    ).map((q) => `${q.moduleCode}::${q.sourceShape}`)
  );

  const report: GenerationReport = {
    created: 0,
    skippedExisting: 0,
    skippedNoDistractors: 0,
    byPillar: {},
  };

  for (const mod of modules) {
    const siblings = (byPillar.get(mod.pillar) ?? []).filter((s) => s.code !== mod.code);

    for (const shape of shapes) {
      if (existing.has(`${mod.code}::${shape}`)) {
        report.skippedExisting++;
        continue;
      }

      const built = buildQuestion(mod, shape, siblings);
      if (!built) {
        report.skippedNoDistractors++;
        continue;
      }

      await prisma.question.create({
        data: {
          pillar: mod.pillar,
          moduleCode: mod.code,
          sourceShape: shape,
          status: "DRAFT", // never selectable until a human approves it
          versions: {
            create: {
              version: 1,
              questionText: built.questionText,
              optionsJson: JSON.stringify(built.options),
              correctIndex: built.correctIndex,
              explanation: built.explanation,
              authorEmail: params.authorEmail,
              isCurrent: true,
            },
          },
        },
      });

      report.created++;
      report.byPillar[mod.pillar] = (report.byPillar[mod.pillar] ?? 0) + 1;
    }
  }

  return report;
}
