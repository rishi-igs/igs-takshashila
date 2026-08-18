import { prisma } from "@/lib/db";
import { activeCountsByPillar } from "@/lib/question-bank";
import { PILLAR_LABELS } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";

export type BankHealthRow = {
  pillar: Pillar;
  label: string;
  required: number;
  available: number;
  shortfall: number;
};

export type BankHealth = {
  rows: BankHealthRow[];
  totalRequired: number;
  totalAvailable: number;
  /** Pillar quotas that don't add up to totalQuestions. */
  quotaMismatch: number | null;
  healthy: boolean;
  warnings: string[];
};

/**
 * Compare a blueprint's recipe against what the bank can actually supply.
 *
 * This is the "warning if there aren't enough questions" half of the
 * blueprint feature: it is deliberately computed on read rather than cached,
 * so the answer reflects the bank as it stands right now — a question retired
 * this morning shows up as a shortfall immediately.
 */
export async function checkBankHealth(blueprintId: string): Promise<BankHealth | null> {
  const blueprint = await prisma.assessmentBlueprint.findUnique({
    where: { id: blueprintId },
    include: { items: true },
  });
  if (!blueprint) return null;

  const available = await activeCountsByPillar();
  const warnings: string[] = [];

  const rows: BankHealthRow[] = blueprint.items.map((item) => {
    const have = available[item.pillar] ?? 0;
    return {
      pillar: item.pillar,
      label: PILLAR_LABELS[item.pillar],
      required: item.count,
      available: have,
      shortfall: Math.max(0, item.count - have),
    };
  });

  const totalRequired = rows.reduce((n, r) => n + r.required, 0);
  const totalAvailable = rows.reduce((n, r) => n + r.available, 0);

  for (const r of rows.filter((r) => r.shortfall > 0)) {
    warnings.push(
      `${r.label}: needs ${r.required} active ${r.required === 1 ? "question" : "questions"}, bank has ${r.available} (short ${r.shortfall}).`
    );
  }

  // A recipe whose parts don't sum to the whole can't be filled as written,
  // which is a different failure from simply running the bank dry.
  const quotaMismatch = totalRequired !== blueprint.totalQuestions ? totalRequired : null;
  if (quotaMismatch !== null) {
    warnings.push(
      `Pillar quotas add up to ${totalRequired}, but the blueprint asks for ${blueprint.totalQuestions} questions.`
    );
  }

  if (blueprint.items.length === 0) {
    warnings.push("No pillar quotas defined — this blueprint can't select any questions yet.");
  }

  if (blueprint.passScore > blueprint.totalQuestions) {
    warnings.push(
      `Pass mark (${blueprint.passScore}) is higher than the number of questions (${blueprint.totalQuestions}) — nobody can pass.`
    );
  }

  return {
    rows,
    totalRequired,
    totalAvailable,
    quotaMismatch,
    healthy: warnings.length === 0,
    warnings,
  };
}

/** Blueprint that applies to a designation: exact match first, else the default. */
export async function resolveBlueprint(designationId: string | null) {
  if (designationId) {
    const specific = await prisma.assessmentBlueprint.findFirst({
      where: { designationId },
      include: { items: true },
    });
    if (specific) return specific;
  }
  return prisma.assessmentBlueprint.findFirst({
    where: { isDefault: true },
    include: { items: true },
  });
}
