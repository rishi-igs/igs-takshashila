import { notFound, redirect } from "next/navigation";
import { requireAdminPage, readFlashCredentials } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

  const [data, selections] = await Promise.all([
    getModuleChecklistData(learner.designationId),
    prisma.learnerModule.findMany({ where: { userId: id }, select: { assignmentId: true, courseId: true } }),
  ]);

  const selectedIds = selections.length > 0 ? new Set(selections.map((s) => s.assignmentId)) : null;
  const courseIdByAssignmentId = new Map(
    selections.filter((s) => s.courseId).map((s) => [s.assignmentId, s.courseId as string])
  );

  const credentials = created ? await readFlashCredentials() : null;

  return (
    <>
      <a href={`/admin/learners/${id}`} className="muted">
        ← {learner.name}
      </a>
      <h1>Choose modules for {learner.name}</h1>
      <p className="subtitle">
        Check the modules this learner should see. Only checked modules will appear on their
        curriculum — leave everything checked, or use &quot;Show entire curriculum&quot; below, to
        give them the full {learner.designation.name} curriculum instead. Mandatory modules can&apos;t
        be excluded and are always included — pick a specific course for this learner from the
        dropdown under each one.
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
          This learner is currently restricted to {selectedIds.size} of {data.assignments.length} modules.
        </p>
      )}

      {data.assignments.length === 0 ? (
        <p className="empty-state">This designation has no modules assigned yet.</p>
      ) : (
        <form action={saveLearnerModulesAction}>
          <input type="hidden" name="learnerId" value={id} />
          <ModuleChecklistFields data={data} selectedIds={selectedIds} courseIdByAssignmentId={courseIdByAssignmentId} />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button type="submit">Save selection</button>
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
