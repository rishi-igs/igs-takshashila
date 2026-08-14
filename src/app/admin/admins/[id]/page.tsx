import { notFound } from "next/navigation";
import { requireAdminPage, readFlashCredentials } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteAdminAction } from "@/lib/actions/admin";

export default async function AdminAdminDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const currentAdmin = await requireAdminPage();
  const { id } = await params;
  const { created, error } = await searchParams;

  const [admin, adminCount] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);
  if (!admin || admin.role !== "ADMIN") notFound();

  const credentials = created ? await readFlashCredentials() : null;
  const isSelf = admin.id === currentAdmin.id;
  const isLastAdmin = adminCount <= 1;

  return (
    <>
      <a href="/admin/admins" className="muted">
        ← Administrators
      </a>
      <h1>{admin.name}</h1>
      <p className="subtitle">{admin.email}</p>

      {error && <p className="form-error">{error}</p>}

      {credentials && credentials.email === admin.email && (
        <div className="form-note">
          <strong>Account created.</strong> Share these credentials with {admin.name} — this
          password is shown once and can&apos;t be retrieved again.
          <br />
          Email: <code>{credentials.email}</code>
          <br />
          Password: <code>{credentials.password}</code>
        </div>
      )}

      <h2>Danger zone</h2>
      {isSelf ? (
        <p className="muted">You can&apos;t delete your own account while logged in as it.</p>
      ) : isLastAdmin ? (
        <p className="muted">This is the last remaining administrator — it can&apos;t be deleted.</p>
      ) : (
        <>
          <p className="muted">
            This removes their login permanently. It doesn&apos;t affect certificates they&apos;ve
            issued or assessments they&apos;ve sent — those records stay as-is.
          </p>
          <form action={deleteAdminAction}>
            <input type="hidden" name="adminId" value={admin.id} />
            <button type="submit" className="danger">
              Delete this administrator
            </button>
          </form>
        </>
      )}
    </>
  );
}
