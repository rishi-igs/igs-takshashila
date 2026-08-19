import { prisma } from "@/lib/db";
import type { Pillar } from "@/generated/prisma/enums";

export async function getModuleChecklistData(designationId: string) {
  const [assignments, courses] = await Promise.all([
    prisma.assignment.findMany({
      where: { designationId },
      include: { module: true },
    }),
    prisma.course.findMany({ orderBy: { name: "asc" } }),
  ]);

  const byPillar = new Map<Pillar, typeof assignments>();
  for (const a of assignments) {
    const list = byPillar.get(a.module.pillar) ?? [];
    list.push(a);
    byPillar.set(a.module.pillar, list);
  }
  for (const list of byPillar.values()) {
    list.sort((a, b) => a.module.name.localeCompare(b.module.name));
  }

  // The Course Library's own "mapped curriculum modules" text names exactly
  // which modules a course was built for (one module name per line) — match
  // on that instead of a shared pillar tag, so each module only offers
  // courses actually built for it, not every course in its pillar.
  const coursesByModuleCode = new Map<string, typeof courses>();
  for (const a of assignments) {
    if (coursesByModuleCode.has(a.module.code)) continue;
    const matches = courses.filter((c) =>
      c.mappedModulesRaw.split("\n").some((line) => line.trim() === a.module.name)
    );
    coursesByModuleCode.set(a.module.code, matches);
  }

  return { assignments, byPillar, coursesByModuleCode };
}

export type ModuleChecklistData = Awaited<ReturnType<typeof getModuleChecklistData>>;
