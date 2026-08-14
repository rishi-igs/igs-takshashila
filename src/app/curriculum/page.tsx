import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import DesignationBrowser from "@/components/DesignationBrowser";

export default async function CurriculumIndexPage() {
  const user = await getCurrentUser();
  // Learners get one dashboard — their own curriculum lives at /my-progress,
  // with editing built in. Browsing other designations isn't essential to them.
  if (user && user.role === "LEARNER") redirect("/my-progress");

  const [designations, hoursAgg] = await Promise.all([
    prisma.designation.findMany({ orderBy: { name: "asc" } }),
    prisma.assignment.groupBy({
      by: ["designationId"],
      _sum: { hours: true },
      _count: { _all: true },
    }),
  ]);

  const statsByDesignation = new Map(
    hoursAgg.map((a) => [a.designationId, { hours: a._sum.hours ?? 0, modules: a._count._all }])
  );

  const items = designations.map((d) => ({
    id: d.id,
    name: d.name,
    roleStage: d.roleStage,
    jobFamily: d.jobFamily,
    hours: statsByDesignation.get(d.id)?.hours ?? 0,
    moduleCount: statsByDesignation.get(d.id)?.modules ?? 0,
  }));

  return (
    <>
      <a href="/" className="muted">
        ← Home
      </a>
      <h1>Curriculum Explorer</h1>
      <p className="subtitle">
        Every IGS designation — {items.length} in total. Search or filter by role stage and job
        family to find the full role-based curriculum.
      </p>
      <DesignationBrowser items={items} />
    </>
  );
}
