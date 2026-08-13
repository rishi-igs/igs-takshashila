import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { submitAssessmentAction } from "@/lib/actions/assessment";
import BeginAssessmentButton from "@/components/BeginAssessmentButton";
import AssessmentRunner from "@/components/AssessmentRunner";

export default async function AssessmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let assessment = await prisma.assessment.findFirst({
    where: { learnerId: user.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    orderBy: { createdAt: "desc" },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  // Learner walked away and came back after time was already up — close it
  // out server-side rather than leaving it stuck open forever.
  if (assessment && assessment.status === "IN_PROGRESS" && assessment.expiresAt && assessment.expiresAt < new Date()) {
    await submitAssessmentAction(assessment.id, {}, true);
    assessment = await prisma.assessment.findUnique({
      where: { id: assessment.id },
      include: { questions: { orderBy: { order: "asc" } } },
    });
  }

  if (!assessment) {
    const latest = await prisma.assessment.findFirst({
      where: { learnerId: user.id, status: "SUBMITTED" },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) {
      return (
        <>
          <h1>Assessment</h1>
          <p className="empty-state">No assessment has been assigned to you yet.</p>
        </>
      );
    }
    return <ResultView score={latest.score ?? 0} total={latest.totalQuestions} autoSubmitted={latest.autoSubmitted} />;
  }

  if (assessment.status === "SUBMITTED") {
    return (
      <ResultView score={assessment.score ?? 0} total={assessment.totalQuestions} autoSubmitted={assessment.autoSubmitted} />
    );
  }

  if (assessment.status === "ASSIGNED") {
    return (
      <div className="auth-form">
        <h1>Assessment ready</h1>
        <p className="subtitle">
          {assessment.totalQuestions} questions, based on your own curriculum. You&apos;ll have{" "}
          {assessment.durationMinutes} minutes once you begin — the timer can&apos;t be paused.
        </p>
        <p className="form-note">
          The page will request fullscreen and watch for tab-switching or leaving the window.
          Repeated attempts to leave will auto-submit your answers early.
        </p>
        <BeginAssessmentButton assessmentId={assessment.id} />
      </div>
    );
  }

  // IN_PROGRESS — hand off to the client-side timer/anti-cheat runner.
  return (
    <AssessmentRunner
      assessmentId={assessment.id}
      expiresAt={assessment.expiresAt!.toISOString()}
      questions={assessment.questions.map((q) => ({
        id: q.id,
        order: q.order,
        questionText: q.questionText,
        options: JSON.parse(q.optionsJson) as string[],
      }))}
    />
  );
}

function ResultView({ score, total, autoSubmitted }: { score: number; total: number; autoSubmitted: boolean }) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);
  const passed = pct >= 60;
  return (
    <>
      <h1>Assessment result</h1>
      <div className="stats-row">
        <div className="stat">
          <div className="value">
            {score} / {total}
          </div>
          <div className="label">Correct answers</div>
        </div>
        <div className="stat">
          <div className="value">{pct}%</div>
          <div className="label">Score</div>
        </div>
        <div className="stat">
          <div className="value">{passed ? "Passed" : "Not passed"}</div>
          <div className="label">Outcome (60% to pass)</div>
        </div>
      </div>
      {autoSubmitted && (
        <p className="form-note">
          This attempt was submitted automatically — either time ran out or the page detected
          repeated attempts to leave the assessment.
        </p>
      )}
      <a href="/my-progress" className="button">
        Back to My Learning
      </a>
    </>
  );
}
