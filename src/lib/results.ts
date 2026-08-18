import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Any Prisma client or transaction client — lets the same helper be called
// from inside submitAssessmentAction's transaction and from a standalone
// regrade.
type Db = Prisma.TransactionClient | typeof prisma;

export const SYSTEM_ACTOR = "system";

/**
 * Append a result record. Never updates an existing one.
 *
 * The first grade for an assessment passes supersedesId = null. A regrade
 * passes the id of the record it replaces, forming a chain that preserves
 * the full history — the original score stays readable forever, which is
 * what makes a disputed grade auditable.
 */
export async function recordResult(
  db: Db,
  params: {
    assessmentId: string;
    score: number;
    totalQuestions: number;
    passScore: number;
    reason: string;
    recordedByEmail: string;
    supersedesId?: string | null;
  }
) {
  return db.assessmentResult.create({
    data: {
      assessmentId: params.assessmentId,
      score: params.score,
      totalQuestions: params.totalQuestions,
      outcome: params.score >= params.passScore ? "PASS" : "FAIL",
      reason: params.reason,
      recordedByEmail: params.recordedByEmail,
      supersedesId: params.supersedesId ?? null,
    },
  });
}

/**
 * The result currently in force: the newest record that nothing supersedes.
 *
 * Ordering by createdAt alone would be ambiguous if two records shared a
 * timestamp, so the absence of a successor is what defines "live" — the
 * supersedesId unique constraint guarantees at most one successor per record.
 */
export async function currentResult(assessmentId: string) {
  const results = await prisma.assessmentResult.findMany({
    where: { assessmentId },
    orderBy: { createdAt: "desc" },
    include: { supersededBy: { select: { id: true } } },
  });
  return results.find((r) => !r.supersededBy) ?? null;
}

/** Full history for an assessment, oldest first. */
export async function resultHistory(assessmentId: string) {
  return prisma.assessmentResult.findMany({
    where: { assessmentId },
    orderBy: { createdAt: "asc" },
  });
}
