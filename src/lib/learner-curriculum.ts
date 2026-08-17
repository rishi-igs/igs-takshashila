import { prisma } from "@/lib/db";
import type { Pillar } from "@/generated/prisma/enums";
import type { CurriculumRow } from "@/components/CurriculumTable";

// A learner with any LearnerModule rows has been restricted to that
// checklist by an admin; with none, they see the whole designation
// curriculum (the original, unrestricted behavior). Returns null when
// unrestricted so callers can skip the `id: { in: [...] } ` filter.
export async function getLearnerAssignmentFilter(userId: string): Promise<Set<string> | null> {
  const selections = await prisma.learnerModule.findMany({
    where: { userId },
    select: { assignmentId: true },
  });
  return selections.length > 0 ? new Set(selections.map((s) => s.assignmentId)) : null;
}

export async function getLearnerCurriculum(userId: string, designationId: string) {
  const selectedIds = await getLearnerAssignmentFilter(userId);

  const assignments = await prisma.assignment.findMany({
    where: { designationId, ...(selectedIds ? { id: { in: [...selectedIds] } } : {}) },
    include: { module: true, progress: { where: { userId } } },
  });

  const byPillar = new Map<Pillar, CurriculumRow[]>();
  for (const a of assignments) {
    const row: CurriculumRow = {
      assignmentId: a.id,
      moduleName: a.module.name,
      moduleCode: a.module.code,
      requirement: a.requirement,
      hours: a.hours,
      standard: a.module.standard,
      freeLearning: a.freeLearning,
      freeLink: a.freeLink,
      premiumLearning: a.premiumLearning,
      premiumLink: a.premiumLink,
      status: (a.progress[0]?.status as CurriculumRow["status"]) ?? "NOT_STARTED",
    };
    const list = byPillar.get(a.module.pillar) ?? [];
    list.push(row);
    byPillar.set(a.module.pillar, list);
  }
  for (const list of byPillar.values()) {
    list.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
  }

  const total = assignments.length;
  const done = assignments.filter((a) => a.progress[0]?.status === "DONE").length;
  const inProgress = assignments.filter((a) => a.progress[0]?.status === "IN_PROGRESS").length;
  const doneHours = assignments
    .filter((a) => a.progress[0]?.status === "DONE")
    .reduce((sum, a) => sum + a.hours, 0);
  const totalHours = assignments.reduce((sum, a) => sum + a.hours, 0);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return { byPillar, total, done, inProgress, doneHours, totalHours, pct };
}
