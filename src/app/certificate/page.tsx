import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function CertificatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const latest = await prisma.certificate.findFirst({
    where: { learnerId: user.id },
    orderBy: { issuedAt: "desc" },
  });

  if (!latest) {
    return (
      <>
        <h1>Certificate</h1>
        <p className="empty-state">No certificate has been issued to you yet.</p>
      </>
    );
  }

  redirect(`/certificate/${latest.id}`);
}
