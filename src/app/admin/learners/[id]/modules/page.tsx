import { notFound, redirect } from "next/navigation";
import { requireAdminPage, readFlashCredentials } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Pillar } from "@/generated/prisma/enums";
import { getModuleChecklistData } from "@/lib/module-checklist";
import ModuleChecklistFields from "@/components/ModuleChecklistFields";
import { saveLearnerModulesAction, resetLearnerModulesAction } from "@/lib/actions/admin";

export default async function LearnerModulesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { created } = await searchParams;

  const learner = await prisma.user.findUnique({ where: { id }, include: { designation: true } });
  if (!learner || learner.role !== "LEARNER") notFound();
  if (!learner.designationId || !learner.designation) {
    redirect(`/admin/learners/${id}`);
  }

  const [fullData, selections] = await Promise.all([
    getModuleChecklistData(learner.designationId),
    prisma.learnerModule.findMany({
      where: { userId: id },
      select: { assignmentId: true, courses: { select: { courseId: true } } },
    }),
  ]);

  const selectedIds = selections.length > 0 ? new Set(selections.map((s) => s.assignmentId)) : null;
  const courseIdsByAssignmentId = new Map(
    selections.map((s) => [s.assignmentId, s.courses.map((c) => c.courseId)])
  );

  // Course access only covers whichever modules this learner already has —
  // the full set if unrestricted, or just their restricted selection from
  // creation time. Changing which modules they have isn't done here.
  const visibleAssignments = selectedIds
    ? fullData.assignments.filter((a) => selectedIds.has(a.id))
    : fullData.assignments;
  const byPillar = new Map<Pillar, typeof visibleAssignments>();
  for (const a of visibleAssignments) {
    const list = byPillar.get(a.module.pillar) ?? [];
    list.push(a);
    byPillar.set(a.module.pillar, list);
  }
  for (const list of byPillar.values()) {
    list.sort((a, b) => a.module.name.localeCompare(b.module.name));
  }
  const data = { ...fullData, byPillar };

  const credentials = created ? await readFlashCredentials() : null;

  return (
    <>
      <a href={`/admin/learners/${id}`} className="muted">
        ← {learner.name}
      </a>
      <h1>Course access for {learner.name}</h1>
      <p className="subtitle">
        Assign a specific course to each of {learner.name}&apos;s modules — the list below is
        whichever modules they already have from {learner.designation.name}. To change which
        modules they have, use &quot;Show entire curriculum&quot; below, or update their selection
        when creating a new learner.
      </p>

      {credentials && credentials.email === learner.email && (
        <div className="form-note">
          <strong>Account created.</strong> Share these credentials with {learner.name} — this
          password is shown once and can&apos;t be retrieved again.
          <br />
          Email: <code>{credentials.email}</code>
          <br />
          Password: <code>{credentials.password}</code>
        </div>
      )}

      {selectedIds && (
        <p className="form-note">
          This learner is currently restricted to {selectedIds.size} of {fullData.assignments.length} modules.
        </p>
      )}

      {visibleAssignments.length === 0 ? (
        <p className="empty-state">This learner has no modules to assign a course to yet.</p>
      ) : (
        <form action={saveLearnerModulesAction}>
          <input type="hidden" name="learnerId" value={id} />
          <ModuleChecklistFields data={data} courseIdsByAssignmentId={courseIdsByAssignmentId} />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button type="submit">Save courses</button>
          </div>
        </form>
      )}

      <form action={resetLearnerModulesAction} style={{ marginTop: "0.75rem" }}>
        <input type="hidden" name="learnerId" value={id} />
        <button type="submit" className="secondary">
          Show entire curriculum (remove restriction)
        </button>
      </form>

      <p style={{ marginTop: "1.25rem" }}>
        <a href={`/admin/learners/${id}`}>Skip for now →</a>
      </p>
    </>
  );
}
