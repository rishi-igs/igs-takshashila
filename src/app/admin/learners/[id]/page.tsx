import { notFound } from "next/navigation";
import { requireAdminPage, readFlashCredentials } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLearnerCurriculum } from "@/lib/learner-curriculum";
import CurriculumTable from "@/components/CurriculumTable";
import LearnerProgressStats from "@/components/LearnerProgressStats";

export default async function AdminLearnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; assessmentSent?: string; error?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { created, assessmentSent, error } = await searchParams;

  const [learner, assessments] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { designation: true } }),
    prisma.assessment.findMany({ where: { learnerId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!learner || learner.role !== "LEARNER") notFound();

  const credentials = created ? await readFlashCredentials() : null;

  return (
    <>
      <a href="/admin/learners" className="muted">
        ← Learners
      </a>
      <h1>{learner.name}</h1>
      <p className="subtitle">{learner.email}</p>

      {error && <p className="form-error">{error}</p>}
      {assessmentSent && <p className="form-note">Assessment sent — the learner will see it on their My Learning page.</p>}

      {credentials && credentials.email === learner.email && (
        <div className="form-note">
          <strong>Account created.</strong> Share these credentials with {learner.name} — this
          password is shown once and can&apos;t be retrieved again.
          <br />
          Email: <code>{credentials.email}</code>
          <br />
          Password: <code>{credentials.password}</code>
        </div>
      )}

      {assessments.length > 0 && (
        <>
          <h2>Assessments</h2>
          <div className="table-wrap" style={{ marginBottom: "1.5rem" }}>
            <table>
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Status</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.createdAt.toLocaleString()}</td>
                    <td>
                      {a.status === "SUBMITTED" ? (a.autoSubmitted ? "Auto-submitted" : "Submitted") : a.status}
                    </td>
                    <td>{a.status === "SUBMITTED" ? `${a.score} / ${a.totalQuestions}` : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!learner.designationId || !learner.designation ? (
        <p className="empty-state">This learner hasn&apos;t set a designation yet.</p>
      ) : (
        <LearnerCurriculumSection userId={learner.id} designationId={learner.designationId} />
      )}
    </>
  );
}

async function LearnerCurriculumSection({ userId, designationId }: { userId: string; designationId: string }) {
  const { byPillar, total, done, inProgress, doneHours, totalHours, pct } = await getLearnerCurriculum(
    userId,
    designationId
  );

  return (
    <>
      <LearnerProgressStats
        pct={pct}
        done={done}
        total={total}
        inProgress={inProgress}
        doneHours={doneHours}
        totalHours={totalHours}
      />
      <CurriculumTable rowsByPillar={byPillar} progressMode="readonly" />
    </>
  );
}
