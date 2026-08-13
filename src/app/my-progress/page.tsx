import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Pillar } from "@/generated/prisma/enums";
import CurriculumTable, { type CurriculumRow } from "@/components/CurriculumTable";

export default async function MyProgressPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.designationId || !user.designation) {
    return (
      <div className="auth-form">
        <h1>My Progress</h1>
        <p className="subtitle">
          You haven&apos;t set a designation yet — pick one so we can show your curriculum.
        </p>
        <a href="/account" className="button">
          Set your designation
        </a>
      </div>
    );
  }

  const assignments = await prisma.assignment.findMany({
    where: { designationId: user.designationId },
    include: { module: true, progress: { where: { userId: user.id } } },
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

  return (
    <>
      <h1>My Progress</h1>
      <p className="subtitle">
        {user.designation.name} · {user.designation.roleStage}
      </p>

      <div className="stats-row">
        <div className="stat">
          <div className="value">{pct}%</div>
          <div className="label">Modules complete</div>
        </div>
        <div className="stat">
          <div className="value">
            {done} / {total}
          </div>
          <div className="label">Done / total modules</div>
        </div>
        <div className="stat">
          <div className="value">{inProgress}</div>
          <div className="label">In progress</div>
        </div>
        <div className="stat">
          <div className="value">
            {doneHours} / {totalHours}
          </div>
          <div className="label">Hours completed</div>
        </div>
      </div>
      <div className="progress-bar" style={{ marginBottom: "1.5rem" }}>
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>

      <CurriculumTable rowsByPillar={byPillar} editable />
    </>
  );
}
