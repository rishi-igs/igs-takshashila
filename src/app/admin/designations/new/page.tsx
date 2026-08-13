import { requireAdminPage } from "@/lib/auth";
import { createDesignationAction } from "@/lib/actions/admin";

export default async function NewDesignationPage({
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
      <h1>Add designation</h1>
      {error && <p className="form-error">{error}</p>}
      <form action={createDesignationAction}>
        <label>
          Name
          <input type="text" name="name" required />
        </label>
        <label>
          Role stage
          <input type="text" name="roleStage" required />
        </label>
        <label>
          Job family
          <input type="text" name="jobFamily" required />
        </label>
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
