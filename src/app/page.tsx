import { prisma } from "@/lib/db";
import DesignationBrowser from "@/components/DesignationBrowser";

export default async function HomePage() {
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

  const totalDesignations = items.length;
  const totalAssignments = items.reduce((sum, i) => sum + i.moduleCount, 0);

  return (
    <>
      <div className="hero">
        <span className="kicker">IGS Takshashila Academy</span>
        <h1>Curriculum Explorer</h1>
        <p className="subtitle">
          Pick a designation to see its full role-based curriculum — modules, hours, standards
          and course links, across all five learning pillars.
        </p>
        <div className="stats-row">
          <div className="stat">
            <div className="value">{totalDesignations}</div>
            <div className="label">Designations</div>
          </div>
          <div className="stat">
            <div className="value">{totalAssignments.toLocaleString()}</div>
            <div className="label">Role-to-module assignments</div>
          </div>
        </div>
      </div>
      <DesignationBrowser items={items} />
    </>
  );
}
