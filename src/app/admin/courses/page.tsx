import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdminPage();
  const { saved } = await searchParams;

  const courses = await prisma.course.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Manage courses</h1>
      <p className="subtitle">{courses.length} courses. Fix links or validation status as they're reviewed.</p>
      {saved && <p className="form-note">Course updated.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Course</th>
              <th>Provider</th>
              <th>Validation status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.provider}</td>
                <td className="muted" style={{ fontSize: "0.85rem" }}>
                  {c.validationStatus}
                </td>
                <td>
                  <a href={`/admin/courses/${c.id}`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
