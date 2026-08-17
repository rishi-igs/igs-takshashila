import { prisma } from "@/lib/db";
import type { Pillar } from "@/generated/prisma/enums";
import type { CurriculumRow } from "@/components/CurriculumTable";

export type LearnerModuleSelection = {
  selectedIds: Set<string> | null;
  courseByAssignmentId: Map<string, { name: string; provider: string; accessType: string; directLink: string | null }>;
};

// A learner with any LearnerModule rows has been restricted to that
// checklist by an admin; with none, they see the whole designation
// curriculum (the original, unrestricted behavior). selectedIds is null
// when unrestricted so callers can skip the `id: { in: [...] } ` filter.
// courseByAssignmentId carries any admin-picked Course Library entry that's
// specific to this learner (mandatory modules only, set on the checklist).
export async function getLearnerModuleSelections(userId: string): Promise<LearnerModuleSelection> {
  const rows = await prisma.learnerModule.findMany({
    where: { userId },
    include: { course: true },
  });
  const courseByAssignmentId = new Map<string, { name: string; provider: string; accessType: string; directLink: string | null }>();
  for (const row of rows) {
    if (row.course) {
      courseByAssignmentId.set(row.assignmentId, {
        name: row.course.name,
        provider: row.course.provider,
        accessType: row.course.accessType,
        directLink: row.course.directLink,
      });
    }
  }
  return {
    selectedIds: rows.length > 0 ? new Set(rows.map((r) => r.assignmentId)) : null,
    courseByAssignmentId,
  };
}

export async function getLearnerAssignmentFilter(userId: string): Promise<Set<string> | null> {
  return (await getLearnerModuleSelections(userId)).selectedIds;
}

// Mandatory modules can never be excluded from a learner's curriculum, no
// matter what a per-learner module restriction says.
export async function getMandatoryAssignmentIds(designationId: string): Promise<Set<string>> {
  const rows = await prisma.assignment.findMany({
    where: { designationId, requirement: "Mandatory" },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

export async function getLearnerCurriculum(userId: string, designationId: string) {
  const { selectedIds, courseByAssignmentId } = await getLearnerModuleSelections(userId);

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
      course: courseByAssignmentId.get(a.id) ?? null,
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
