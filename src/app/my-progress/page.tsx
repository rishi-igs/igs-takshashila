import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLearnerCurriculum } from "@/lib/learner-curriculum";
import CurriculumTable from "@/components/CurriculumTable";
import LearnerProgressStats from "@/components/LearnerProgressStats";

export default async function MyProgressPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [activeAssessment, latestCertificate] = await Promise.all([
    prisma.assessment.findFirst({
      where: { learnerId: user.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    }),
    prisma.certificate.findFirst({ where: { learnerId: user.id }, orderBy: { issuedAt: "desc" } }),
  ]);

  if (!user.designationId || !user.designation) {
    return (
      <div className="auth-form">
        <h1>My Progress</h1>
        <p className="subtitle">
          You haven&apos;t set a designation yet — pick one so we can show your curriculum.
        </p>
        <a href="/account" className="button">
          Set your designation
        </a>
      </div>
    );
  }

  const { byPillar, total, done, inProgress, doneHours, totalHours, pct } = await getLearnerCurriculum(
    user.id,
    user.designationId
  );

  return (
    <>
      <h1>My Progress</h1>
      <p className="subtitle">
        {user.designation.name} · {user.designation.roleStage}
      </p>

      {latestCertificate && (
        <div className="form-note">
          <strong>Your certificate is ready.</strong>{" "}
          <a href={`/certificate/${latestCertificate.id}`} style={{ fontWeight: 700 }}>
            View / download it →
          </a>
        </div>
      )}

      {activeAssessment && (
        <div className="form-note">
          <strong>You have an assessment to complete</strong> — 25 questions, 20 minutes, based on
          your curriculum.{" "}
          <a href="/assessment" style={{ fontWeight: 700 }}>
            {activeAssessment.status === "IN_PROGRESS" ? "Resume it" : "Start it"} →
          </a>
        </div>
      )}

      <LearnerProgressStats
        pct={pct}
        done={done}
        total={total}
        inProgress={inProgress}
        doneHours={doneHours}
        totalHours={totalHours}
      />

      <CurriculumTable rowsByPillar={byPillar} progressMode="editable" />
    </>
  );
}
