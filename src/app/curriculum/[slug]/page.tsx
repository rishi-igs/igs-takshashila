import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import type { Pillar } from "@/generated/prisma/enums";
import CurriculumTable, { type CurriculumRow } from "@/components/CurriculumTable";

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [designations, user] = await Promise.all([prisma.designation.findMany(), getCurrentUser()]);
  const designation = designations.find((d) => slugify(d.name) === slug);
  if (!designation) notFound();

  const editable = Boolean(user && user.designationId === designation.id);

  const assignments = await prisma.assignment.findMany({
    where: { designationId: designation.id },
    include: {
      module: true,
      progress: editable ? { where: { userId: user!.id } } : false,
    },
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
      status: editable ? (a.progress?.[0]?.status as CurriculumRow["status"]) ?? "NOT_STARTED" : undefined,
    };
    const list = byPillar.get(a.module.pillar) ?? [];
    list.push(row);
    byPillar.set(a.module.pillar, list);
  }
  for (const list of byPillar.values()) {
    list.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
  }

  const totalHours = assignments.reduce((sum, a) => sum + a.hours, 0);

  return (
    <>
      <a href="/" className="muted">
        ← All designations
      </a>
      <h1>{designation.name}</h1>
      <p className="subtitle">
        {designation.roleStage} · {designation.jobFamily}
      </p>
      {editable && (
        <p className="form-note">
          This is your designation — mark modules as in progress or done directly below.
        </p>
      )}
      <div className="stats-row">
        <div className="stat">
          <div className="value">{assignments.length}</div>
          <div className="label">Modules assigned</div>
        </div>
        <div className="stat">
          <div className="value">{totalHours}</div>
          <div className="label">Total hours</div>
        </div>
        <div className="stat">
          <div className="value">{byPillar.size}</div>
          <div className="label">Pillars covered</div>
        </div>
      </div>

      <CurriculumTable rowsByPillar={byPillar} editable={editable} />
    </>
  );
}
