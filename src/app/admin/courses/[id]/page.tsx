import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateCourseAction } from "@/lib/actions/admin";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) notFound();

  return (
    <div className="auth-form">
      <a href="/admin/courses" className="muted">
        ← Courses
      </a>
      <h1>{course.name}</h1>
      <p className="subtitle">{course.provider}</p>
      <form action={updateCourseAction}>
        <input type="hidden" name="id" value={course.id} />
        <label>
          Direct link
          <input type="text" name="directLink" defaultValue={course.directLink ?? ""} />
        </label>
        <label>
          Validation status
          <input type="text" name="validationStatus" defaultValue={course.validationStatus} />
        </label>
        <label>
          Quality note
          <input type="text" name="qualityNote" defaultValue={course.qualityNote ?? ""} />
        </label>
        <button type="submit">Save</button>
      </form>
    </div>
  );
}
