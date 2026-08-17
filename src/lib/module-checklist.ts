import { prisma } from "@/lib/db";
import { PILLAR_ORDER } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";

export async function getModuleChecklistData(designationId: string) {
  const [assignments, courses] = await Promise.all([
    prisma.assignment.findMany({
      where: { designationId },
      include: { module: true },
    }),
    prisma.course.findMany({ include: { pillars: true }, orderBy: { name: "asc" } }),
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

  // Courses tagged with a pillar are the most relevant match for a module in
  // that pillar; fall back to the full library where nothing is tagged yet.
  const coursesByPillar = new Map<Pillar, typeof courses>();
  for (const pillar of PILLAR_ORDER) {
    const tagged = courses.filter((c) => c.pillars.some((p) => p.pillar === pillar));
    coursesByPillar.set(pillar, tagged.length > 0 ? tagged : courses);
  }

  return { assignments, byPillar, coursesByPillar };
}

export type ModuleChecklistData = Awaited<ReturnType<typeof getModuleChecklistData>>;
