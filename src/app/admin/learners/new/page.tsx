import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLearnerAction } from "@/lib/actions/admin";
import { getModuleChecklistData } from "@/lib/module-checklist";
import ModuleChecklistFields from "@/components/ModuleChecklistFields";

// This page has two steps driven entirely by searchParams (name/email/
// designationId) via a plain GET form — force dynamic rendering so each
// step's query string always gets a fresh render, never a cached one.
export const dynamic = "force-dynamic";

export default async function NewLearnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; name?: string; email?: string; designationId?: string }>;
}) {
  await requireAdminPage();
  const { error, name, email, designationId } = await searchParams;

  if (name && email) {
    return <ModulesStep name={name} email={email} designationId={designationId || ""} error={error} />;
  }

  const designations = await prisma.designation.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="auth-form">
      <a href="/admin/learners" className="muted">
        ← Learners
      </a>
      <h1>Create learner</h1>
      <p className="subtitle">
        Pick a designation to choose which modules this learner sees, and a course for each
        mandatory one, on the next step. A password is generated automatically — you&apos;ll see
        it once at the end.
      </p>
      {error && <p className="form-error">{error}</p>}
      <form method="get" action="/admin/learners/new">
        <label>
          Name
          <input type="text" name="name" required />
        </label>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Designation (optional — the learner can set this later)
          <select name="designationId" defaultValue="">
            <option value="">Not set</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Continue</button>
      </form>
    </div>
  );
}

async function ModulesStep({
  name,
  email,
  designationId,
  error,
}: {
  name: string;
  email: string;
  designationId: string;
  error?: string;
}) {
  const designation = designationId
    ? await prisma.designation.findUnique({ where: { id: designationId } })
    : null;

  if (!designationId || !designation) {
    return (
      <div className="auth-form">
        <a href="/admin/learners/new" className="muted">
          ← Start over
        </a>
        <h1>Create learner</h1>
        <p className="subtitle">
          {name} · {email} · no designation set, so there&apos;s nothing to choose modules from yet
          — the learner (or an admin) can set one later.
        </p>
        {error && <p className="form-error">{error}</p>}
        <form action={createLearnerAction}>
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="email" value={email} />
          <button type="submit">Create learner</button>
        </form>
      </div>
    );
  }

  const data = await getModuleChecklistData(designationId);

  return (
    <>
      <a href="/admin/learners/new" className="muted">
        ← Start over
      </a>
      <h1>Modules for {name}</h1>
      <p className="subtitle">
        {email} · {designation.name}. Leave everything checked for the full curriculum, or uncheck
        a module to hide it. Mandatory modules can&apos;t be excluded — pick a course for each from
        its dropdown. A password is generated automatically — you&apos;ll see it once on the next
        screen.
      </p>
      {error && <p className="form-error">{error}</p>}
      <form action={createLearnerAction}>
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="designationId" value={designationId} />
        {data.assignments.length === 0 ? (
          <p className="empty-state">This designation has no modules assigned yet.</p>
        ) : (
          <ModuleChecklistFields data={data} selectedIds={null} courseIdByAssignmentId={new Map()} />
        )}
        <div style={{ marginTop: "1.5rem" }}>
          <button type="submit">Create learner</button>
        </div>
      </form>
    </>
  );
}
