import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAssignmentAction } from "@/lib/actions/admin";

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  const [designations, modules] = await Promise.all([
    prisma.designation.findMany({ orderBy: { name: "asc" } }),
    prisma.module.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="auth-form">
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Add assignment</h1>
      <p className="subtitle">Assign an existing module to an existing designation.</p>
      {error && <p className="form-error">{error}</p>}
      <form action={createAssignmentAction}>
        <label>
          Designation
          <select name="designationId" required defaultValue="">
            <option value="" disabled>
              Select...
            </option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Module
          <select name="moduleCode" required defaultValue="">
            <option value="" disabled>
              Select...
            </option>
            {modules.map((m) => (
              <option key={m.code} value={m.code}>
                {m.code} — {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Requirement
          <select name="requirement" required defaultValue="Mandatory">
            <option value="Mandatory">Mandatory</option>
            <option value="Deployment-specific">Deployment-specific</option>
            <option value="Choose one">Choose one</option>
          </select>
        </label>
        <label>
          Hours
          <input type="number" name="hours" min="0" required />
        </label>
        <label>
          Free/official learning (name)
          <input type="text" name="freeLearning" />
        </label>
        <label>
          Free/official link
          <input type="text" name="freeLink" />
        </label>
        <label>
          Premium learning (name)
          <input type="text" name="premiumLearning" />
        </label>
        <label>
          Premium link
          <input type="text" name="premiumLink" />
        </label>
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
