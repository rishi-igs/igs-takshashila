import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; error?: string }>;
}) {
  const currentAdmin = await requireAdminPage();
  const { deleted, error } = await searchParams;

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Administrators</h1>
      <p className="subtitle">{admins.length} administrator accounts.</p>

      {deleted && <p className="form-note">Administrator removed.</p>}
      {error && <p className="form-error">{error}</p>}

      <a href="/admin/admins/new" className="button">
        + Create administrator
      </a>

      <div className="table-wrap" style={{ marginTop: "1.5rem" }}>
        <table>
          <thead>
            <tr>
              <th>Administrator</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {a.name} {a.id === currentAdmin.id && <span className="muted">(you)</span>}
                  </div>
                  <div className="muted" style={{ fontSize: "0.82rem" }}>
                    {a.email}
                  </div>
                </td>
                <td>{a.createdAt.toLocaleDateString()}</td>
                <td>
                  <a href={`/admin/admins/${a.id}`}>View</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
