import { prisma } from "@/lib/db";

/**
 * Move a learner into a designation and open a dated enrolment for it.
 *
 * Closes any currently ACTIVE enrolment first — the database enforces at
 * most one ACTIVE row per learner (partial unique index), so closing before
 * opening is required, not just tidy. Both writes plus the User update run
 * in one transaction so a learner can never be left with a stale ACTIVE row
 * pointing at a designation they've moved off.
 *
 * Returns the new enrolment.
 */
export async function openEnrolment(
  userId: string,
  designationId: string,
  note?: string
) {
  return prisma.$transaction(async (tx) => {
    await tx.enrolment.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "COMPLETED", endedAt: new Date() },
    });

    await tx.user.update({ where: { id: userId }, data: { designationId } });

    return tx.enrolment.create({
      data: { userId, designationId, status: "ACTIVE", note: note ?? null },
    });
  });
}

/** Whole-days elapsed since a date. Used to show tenure in the admin UI. */
export function daysSince(from: Date, to: Date = new Date()): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export function formatTenure(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 61) return `${days} days`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months`;
  return `${(days / 365.25).toFixed(1)} years`;
}
