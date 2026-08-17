import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createLearnerAction } from "@/lib/actions/admin";
import { PILLAR_ORDER, PILLAR_LABELS } from "@/lib/pillars";

export default async function NewLearnerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  const designations = await prisma.designation.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="auth-form">
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
        <div>
          <span className="dropdown-label">Modules</span>
          <details className="dropdown">
            <summary>Select modules</summary>
            <div className="dropdown-panel">
              <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 0.6rem" }}>
                Leave everything checked to give the learner their full designation curriculum, or
                uncheck a pillar to hide it from them.
              </p>
              {PILLAR_ORDER.map((pillar) => (
                <label key={pillar} className="dropdown-option">
                  <input type="checkbox" name="pillar" value={pillar} defaultChecked />
                  <span>{PILLAR_LABELS[pillar]}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
        <button type="submit">Create learner</button>
      </form>
    </div>
  );
}
