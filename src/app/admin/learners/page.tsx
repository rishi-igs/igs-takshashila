import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAssessmentAction, issueCertificateAction } from "@/lib/actions/admin";
import { CERTIFICATE_PASS_SCORE } from "@/lib/certificate";

export default async function AdminLearnersPage() {
  await requireAdminPage();

  const [learners, assignmentCounts, doneCounts, activeAssessments, submittedAssessments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "LEARNER" },
      include: { designation: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.assignment.groupBy({ by: ["designationId"], _count: { _all: true } }),
    prisma.progress.groupBy({ by: ["userId"], where: { status: "DONE" }, _count: { _all: true } }),
    prisma.assessment.findMany({
      where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
      select: { learnerId: true },
    }),
    prisma.assessment.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { createdAt: "desc" },
      include: { certificate: true },
    }),
  ]);

  const totalByDesignation = new Map(assignmentCounts.map((a) => [a.designationId, a._count._all]));
  const doneByUser = new Map(doneCounts.map((d) => [d.userId, d._count._all]));
  const hasActiveAssessment = new Set(activeAssessments.map((a) => a.learnerId));

  // First (most recent, since already ordered desc) submitted assessment per learner.
  const latestAssessmentByLearner = new Map<string, (typeof submittedAssessments)[number]>();
  for (const a of submittedAssessments) {
    if (!latestAssessmentByLearner.has(a.learnerId)) latestAssessmentByLearner.set(a.learnerId, a);
  }

  return (
    <>
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Learners</h1>
      <p className="subtitle">{learners.length} learner accounts.</p>
      <a href="/admin/learners/new" className="button">
        + Create learner
      </a>

      {learners.length === 0 ? (
        <p className="empty-state">No learners yet — create the first one.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: "1.5rem" }}>
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Designation</th>
                <th>Progress</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => {
                const total = l.designationId ? totalByDesignation.get(l.designationId) ?? 0 : 0;
                const done = doneByUser.get(l.id) ?? 0;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                const complete = total > 0 && done >= total;
                const pending = hasActiveAssessment.has(l.id);
                const latestAssessment = latestAssessmentByLearner.get(l.id);
                const eligibleForCertificate =
                  latestAssessment && (latestAssessment.score ?? 0) >= CERTIFICATE_PASS_SCORE;
                return (
                  <tr key={l.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{l.name}</div>
                      <div className="muted" style={{ fontSize: "0.82rem" }}>
                        {l.email}
                      </div>
                    </td>
                    <td>{l.designation ? l.designation.name : <span className="muted">Not set</span>}</td>
                    <td>
                      {l.designationId ? (
                        <>
                          {done} / {total} ({pct}%)
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <a href={`/admin/learners/${l.id}`}>View</a>
                    </td>
                    <td>
                      {pending ? (
                        <span className="muted" style={{ fontSize: "0.85rem" }}>
                          Assessment pending
                        </span>
                      ) : complete ? (
                        <form action={createAssessmentAction}>
                          <input type="hidden" name="learnerId" value={l.id} />
                          <button type="submit" className="secondary">
                            Send assessment
                          </button>
                        </form>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.85rem" }}>
                          Complete curriculum first
                        </span>
                      )}
                    </td>
                    <td>
                      {latestAssessment?.certificate ? (
                        <a href={`/certificate/${latestAssessment.certificate.id}`}>View certificate</a>
                      ) : eligibleForCertificate ? (
                        <form action={issueCertificateAction}>
                          <input type="hidden" name="learnerId" value={l.id} />
                          <button type="submit" className="secondary">
                            Issue certificate
                          </button>
                        </form>
                      ) : latestAssessment ? (
                        <span className="muted" style={{ fontSize: "0.85rem" }}>
                          Score {latestAssessment.score}/{latestAssessment.totalQuestions} — needs{" "}
                          {CERTIFICATE_PASS_SCORE}+
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.85rem" }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
