import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CertificateView from "@/components/CertificateView";
import PrintCertificateButton from "@/components/PrintCertificateButton";

export default async function CertificateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const certificate = await prisma.certificate.findUnique({ where: { id } });
  if (!certificate) notFound();

  const canView = certificate.learnerId === user.id || user.role === "ADMIN";
  if (!canView) notFound();

  const backHref = user.role === "ADMIN" ? `/admin/learners/${certificate.learnerId}` : "/my-progress";

  return (
    <>
      <a href={backHref} className="muted no-print">
        ← Back
      </a>
      <CertificateView
        learnerName={certificate.learnerName}
        designationName={certificate.designationName}
        score={certificate.score}
        totalQuestions={certificate.totalQuestions}
        certificateNumber={certificate.certificateNumber}
        issuedAt={certificate.issuedAt}
      />
      <div className="no-print" style={{ textAlign: "center" }}>
        <PrintCertificateButton />
      </div>
    </>
  );
}
