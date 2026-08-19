import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLearnerAction } from "@/lib/actions/admin";
import { getModuleChecklistData } from "@/lib/module-checklist";
import { CourseAccessDropdown } from "@/components/LearnerModuleDropdowns";
import ModuleSelectDropdown from "@/components/ModuleSelectDropdown";
import DesignationField from "@/components/DesignationField";
import { PILLAR_ORDER } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";

export default async function NewLearnerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const name = typeof sp.name === "string" ? sp.name : "";
  const email = typeof sp.email === "string" ? sp.email : "";
  const designationId = typeof sp.designationId === "string" ? sp.designationId : "";

  // Once any reload has happened (designation or pillar change), the pillar
  // checkboxes' state is exactly whatever is in the query string — including
  // zero, if every box ended up unchecked. Before the first reload, default
  // to everything checked, matching the page's initial state.
  const pillarsTouched = sp.pillarsTouched === "1";
  const pillarRaw = sp.pillar;
  const checkedPillars: Pillar[] = pillarsTouched
    ? ((Array.isArray(pillarRaw) ? pillarRaw : pillarRaw ? [pillarRaw] : []) as Pillar[])
    : [...PILLAR_ORDER];

  const courseIdsByAssignmentId = new Map<string, string[]>();
  for (const [key, value] of Object.entries(sp)) {
    if (!key.startsWith("courseIds_") || !value) continue;
    courseIdsByAssignmentId.set(key.slice("courseIds_".length), Array.isArray(value) ? value : [value]);
  }

  const designations = await prisma.designation.findMany({ orderBy: { name: "asc" } });
  const selectedDesignation = designationId ? designations.find((d) => d.id === designationId) : undefined;
  const checklistData = selectedDesignation ? await getModuleChecklistData(designationId) : null;

  return (
    <div className="auth-form wide-form">
      <a href="/admin/learners" className="muted">
        ← Learners
      </a>
      <h1>Create learner</h1>
      <p className="subtitle">
        A password is generated automatically — you&apos;ll see it once on the next screen to pass
        along to the learner.
      </p>
      {error && <p className="form-error">{error}</p>}
      <form action={createLearnerAction}>
        <div className="field-row">
          <label>
            Name
            <input type="text" name="name" defaultValue={name} required />
          </label>
          <label>
            Email
            <input type="email" name="email" defaultValue={email} required />
          </label>
          <label>
            Designation
            <DesignationField designations={designations} defaultValue={designationId} />
            <span className="muted" style={{ fontWeight: 400, fontSize: "0.78rem" }}>
              Optional — the learner can set this later.
            </span>
          </label>
        </div>

        <div className="field-row field-row-2">
          <div>
            <span className="dropdown-label">Select modules</span>
            <ModuleSelectDropdown checkedPillars={checkedPillars} />
          </div>

          <div>
            <span className="dropdown-label">Course access</span>
            {!selectedDesignation ? (
              <p className="muted" style={{ fontSize: "0.82rem" }}>
                Pick a designation above to choose which course covers each module.
              </p>
            ) : !checklistData || checklistData.assignments.length === 0 ? (
              <p className="muted" style={{ fontSize: "0.82rem" }}>
                {selectedDesignation.name} has no modules assigned yet.
              </p>
            ) : (
              <CourseAccessDropdown
                data={checklistData}
                checkedPillars={checkedPillars}
                courseIdsByAssignmentId={courseIdsByAssignmentId}
              />
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
          <button type="submit">Create learner</button>
        </div>
      </form>
    </div>
  );
}
