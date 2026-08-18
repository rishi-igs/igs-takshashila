import { notFound } from "next/navigation";
import { requireAdminPage, readFlashCredentials } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getLearnerCurriculum } from "@/lib/learner-curriculum";
import { daysSince, formatTenure } from "@/lib/enrolment";
import { regradeAssessmentAction } from "@/lib/actions/testops";
import CurriculumTable from "@/components/CurriculumTable";
import LearnerProgressStats from "@/components/LearnerProgressStats";

export default async function AdminLearnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    assessmentSent?: string;
    certificateIssued?: string;
    modulesSaved?: string;
    error?: string;
  }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { created, assessmentSent, certificateIssued, modulesSaved, error } = await searchParams;

  const [learner, assessments, certificates, enrolments] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { designation: true } }),
    prisma.assessment.findMany({ where: { learnerId: id }, orderBy: { createdAt: "desc" } }),
    prisma.certificate.findMany({ where: { learnerId: id }, orderBy: { issuedAt: "desc" } }),
    prisma.enrolment.findMany({
      where: { userId: id },
      orderBy: { startedAt: "desc" },
      include: { designation: true },
    }),
  ]);
  if (!learner || learner.role !== "LEARNER") notFound();
  const certificateByAssessmentId = new Map(certificates.map((c) => [c.assessmentId, c]));
  const activeEnrolment = enrolments.find((e) => e.status === "ACTIVE");

  // Append-only grade history. A record that another record supersedes is
  // historical; the one nothing supersedes is the grade in force.
  const results = await prisma.assessmentResult.findMany({
    where: { assessmentId: { in: assessments.map((a) => a.id) } },
    orderBy: { createdAt: "asc" },
  });
  const supersededIds = new Set(results.map((r) => r.supersedesId).filter(Boolean) as string[]);
  const resultsByAssessmentId = new Map<string, typeof results>();
  for (const r of results) {
    const list = resultsByAssessmentId.get(r.assessmentId) ?? [];
    list.push(r);
    resultsByAssessmentId.set(r.assessmentId, list);
  }

  const credentials = created ? await readFlashCredentials() : null;

  return (
    <>
      <a href="/admin/learners" className="muted">
        ← Learners
      </a>
      <h1>{learner.name}</h1>
      <p className="subtitle">
        {learner.email}
        {activeEnrolment && (
          <>
            {" — "}
            {activeEnrolment.designation.name} for{" "}
            {formatTenure(daysSince(activeEnrolment.startedAt))}
          </>
        )}
      </p>

      {error && <p className="form-error">{error}</p>}
      {modulesSaved && <p className="form-note">Module selection saved.</p>}
      {assessmentSent && <p className="form-note">Assessment sent — the learner will see it on their My Learning page.</p>}
      {certificateIssued && (
        <p className="form-note">
          Certificate issued —{" "}
          <a href={`/certificate/${certificateIssued}`} style={{ fontWeight: 700 }}>
            view it
          </a>
          . The learner will see it on their My Learning page too.
        </p>
      )}

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
                  <th>Grade history</th>
                  <th>Certificate</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => {
                  const cert = certificateByAssessmentId.get(a.id);
                  const history = resultsByAssessmentId.get(a.id) ?? [];
                  const live = history.find((r) => !supersededIds.has(r.id));
                  return (
                    <tr key={a.id}>
                      <td>{a.createdAt.toLocaleString()}</td>
                      <td>
                        {a.status === "SUBMITTED" ? (a.autoSubmitted ? "Auto-submitted" : "Submitted") : a.status}
                      </td>
                      <td>
                        {live ? (
                          <>
                            {live.score} / {live.totalQuestions}{" "}
                            <span className="pill">{live.outcome}</span>
                          </>
                        ) : a.status === "SUBMITTED" ? (
                          `${a.score} / ${a.totalQuestions}`
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {history.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <ol style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.82rem" }}>
                            {history.map((r) => (
                              <li key={r.id} className={supersededIds.has(r.id) ? "muted" : undefined}>
                                {r.score}/{r.totalQuestions} — {r.reason}
                                {supersededIds.has(r.id) && " (superseded)"}
                              </li>
                            ))}
                          </ol>
                        )}
                      </td>
                      <td>
                        {cert ? (
                          <a href={`/certificate/${cert.id}`}>View</a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {a.status === "SUBMITTED" && (
                          <form action={regradeAssessmentAction}>
                            <input type="hidden" name="assessmentId" value={a.id} />
                            <input
                              type="text"
                              name="note"
                              placeholder="Reason"
                              style={{ width: "8rem", fontSize: "0.82rem" }}
                            />
                            <button type="submit" className="secondary">
                              Regrade
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {enrolments.length > 1 && (
        <>
          <h2 className="section-heading">Role history</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Designation</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Held for</th>
                </tr>
              </thead>
              <tbody>
                {enrolments.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.designation.name}</div>
                      {e.note && (
                        <div className="muted" style={{ fontSize: "0.82rem" }}>
                          {e.note}
                        </div>
                      )}
                    </td>
                    <td>{e.startedAt.toLocaleDateString()}</td>
                    <td>{e.endedAt ? e.endedAt.toLocaleDateString() : <span className="pill">Current</span>}</td>
                    <td>{formatTenure(daysSince(e.startedAt, e.endedAt ?? undefined))}</td>
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
        <>
          <a
            href={`/admin/learners/${learner.id}/modules`}
            className="button secondary"
            style={{ marginBottom: "1.25rem" }}
          >
            Manage module access
          </a>
          <LearnerCurriculumSection userId={learner.id} designationId={learner.designationId} />
        </>
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
