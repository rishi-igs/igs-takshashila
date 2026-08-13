import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import CourseBrowser from "@/components/CourseBrowser";

export default async function CoursesPage() {
  const user = await getCurrentUser();
  if (user && user.role === "LEARNER") redirect("/my-progress");

  const courses = await prisma.course.findMany({
    include: { pillars: true },
    orderBy: { name: "asc" },
  });

  const items = courses.map((c) => ({
    id: c.id,
    provider: c.provider,
    name: c.name,
    accessType: c.accessType,
    directLink: c.directLink,
    pillars: c.pillars.map((p) => p.pillar),
    qualityNote: c.qualityNote,
    validationStatus: c.validationStatus,
  }));

  return (
    <>
      <h1>Course Library</h1>
      <p className="subtitle">
        {items.length} deduplicated external and internal learning resources, mapped to the
        curriculum. Filter by provider, pillar or access type.
      </p>
      <CourseBrowser items={items} />
    </>
  );
}
