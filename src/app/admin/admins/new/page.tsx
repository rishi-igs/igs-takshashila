import { requireAdminPage } from "@/lib/auth";
import { createAdminAction } from "@/lib/actions/admin";

export default async function NewAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  return (
    <div className="auth-form">
      <a href="/admin/admins" className="muted">
        ← Administrators
      </a>
      <h1>Create administrator</h1>
      <p className="subtitle">
        A password is generated automatically — you&apos;ll see it once on the next screen to pass
        along to them. They&apos;ll have full admin access, same as you.
      </p>
      {error && <p className="form-error">{error}</p>}
      <form action={createAdminAction}>
        <label>
          Name
          <input type="text" name="name" required />
        </label>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <button type="submit">Create administrator</button>
      </form>
    </div>
  );
}
