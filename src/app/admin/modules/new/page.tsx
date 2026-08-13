import { requireAdminPage } from "@/lib/auth";
import { createModuleAction } from "@/lib/actions/admin";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";

export default async function NewModulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  return (
    <div className="auth-form">
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Add module</h1>
      {error && <p className="form-error">{error}</p>}
      <form action={createModuleAction}>
        <label>
          Module code
          <input type="text" name="code" placeholder="e.g. PT-999" required />
        </label>
        <label>
          Pillar
          <select name="pillar" required defaultValue="">
            <option value="" disabled>
              Select a pillar...
            </option>
            {PILLAR_ORDER.map((p) => (
              <option key={p} value={p}>
                {PILLAR_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Curriculum module name
          <input type="text" name="name" required />
        </label>
        <label>
          Capability and topics covered
          <input type="text" name="capabilityTopics" />
        </label>
        <label>
          Practical output and assessment
          <input type="text" name="practicalOutput" />
        </label>
        <label>
          Standard or expectation
          <input type="text" name="standard" />
        </label>
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
