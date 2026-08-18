import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdminPage();
  const { saved } = await searchParams;

  const [userCount, courseCount, designationCount, moduleCount] = await Promise.all([
    prisma.user.count(),
    prisma.course.count(),
    prisma.designation.count(),
    prisma.module.count(),
  ]);

  return (
    <>
      <h1>Admin</h1>
      {saved && <p className="form-note">Saved.</p>}
      <div className="stats-row">
        <div className="stat">
          <div className="value">{userCount}</div>
          <div className="label">Users</div>
        </div>
        <div className="stat">
          <div className="value">{designationCount}</div>
          <div className="label">Designations</div>
        </div>
        <div className="stat">
          <div className="value">{moduleCount}</div>
          <div className="label">Modules</div>
        </div>
        <div className="stat">
          <div className="value">{courseCount}</div>
          <div className="label">Courses</div>
        </div>
      </div>
      <div className="card-grid" style={{ marginTop: "1.5rem" }}>
        <a className="card" href="/admin/learners">
          <div className="name">Learners</div>
          <div className="meta">Create accounts, review individual performance</div>
        </a>
        <a className="card" href="/admin/admins">
          <div className="name">Administrators</div>
          <div className="meta">Create or remove admin accounts</div>
        </a>
        <a className="card" href="/admin/courses">
          <div className="name">Manage courses</div>
          <div className="meta">Edit links, validation status, notes</div>
        </a>
        <a className="card" href="/admin/designations/new">
          <div className="name">Add designation</div>
          <div className="meta">Create a new role</div>
        </a>
        <a className="card" href="/admin/modules/new">
          <div className="name">Add module</div>
          <div className="meta">Create a new curriculum module</div>
        </a>
        <a className="card" href="/admin/assignments/new">
          <div className="name">Add assignment</div>
          <div className="meta">Assign a module to a designation</div>
        </a>
        <a className="card" href="/reports">
          <div className="name">Reports</div>
          <div className="meta">Completion by designation and pillar</div>
        </a>
        <Link className="card" href="/admin/questions">
          <div className="name">Question bank</div>
          <div className="meta">Write and version assessment questions</div>
        </Link>
        <Link className="card" href="/admin/blueprints">
          <div className="name">Assessment blueprints</div>
          <div className="meta">Test recipes and bank-health warnings</div>
        </Link>
        <a className="card" href="/admin/permissions">
          <div className="name">Permission matrix</div>
          <div className="meta">What each role can do and whose records they can see</div>
        </a>
        <a className="card" href="/admin/audit">
          <div className="name">Audit log</div>
          <div className="meta">Who did what, and when</div>
        </a>
      </div>
    </>
  );
}
