import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PILLAR_LABELS } from "@/lib/pillars";
import { reviseQuestionAction, setQuestionStatusAction } from "@/lib/actions/testops";

const OPTION_SLOTS = 6;

export default async function QuestionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; revised?: string; saved?: string; error?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const { created, revised, saved, error } = await searchParams;

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" } },
      module: { select: { code: true, name: true } },
    },
  });
  if (!question) notFound();

  const current = question.versions.find((v) => v.isCurrent) ?? question.versions[0];
  const currentOptions: string[] = current ? JSON.parse(current.optionsJson) : [];

  // How many past attempts were graded against each version — this is what
  // makes the "never changes past tests" guarantee visible.
  const usage = await prisma.assessmentQuestion.groupBy({
    by: ["questionVersionId"],
    where: { questionVersionId: { in: question.versions.map((v) => v.id) } },
    _count: { _all: true },
  });
  const usageByVersion = new Map(usage.map((u) => [u.questionVersionId, u._count._all]));

  return (
    <>
      <Link href="/admin/questions" className="muted">
        ← Question bank
      </Link>
      <h1>Edit question</h1>
      <p className="subtitle">
        {PILLAR_LABELS[question.pillar]}
        {question.module && ` — module ${question.module.code}`} — currently version{" "}
        {current?.version ?? "?"} of {question.versions.length}
      </p>

      {created && <p className="form-note">Question created as version 1.</p>}
      {revised && <p className="form-note">Saved as version {revised}. Earlier versions are untouched.</p>}
      {saved && <p className="form-note">Status updated.</p>}
      {error && <p className="form-error">{error}</p>}

      <form action={setQuestionStatusAction} style={{ margin: "1rem 0" }}>
        <input type="hidden" name="questionId" value={question.id} />
        <label>
          Status
          <select name="status" defaultValue={question.status}>
            <option value="DRAFT">Draft — not selectable</option>
            <option value="ACTIVE">Active — eligible for selection</option>
            <option value="RETIRED">Retired — withdrawn from selection</option>
          </select>
        </label>
        <button type="submit" className="secondary">
          Update status
        </button>
      </form>

      <h2 className="section-heading">Revise</h2>
      <p className="muted">
        Saving appends a new version and makes it current. Nothing already graded changes.
      </p>

      <form action={reviseQuestionAction} className="auth-form" style={{ maxWidth: "44rem" }}>
        <input type="hidden" name="questionId" value={question.id} />

        <label>
          Question text
          <textarea name="questionText" rows={3} required defaultValue={current?.questionText ?? ""} />
        </label>

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem" }}>
          <legend>Options — select the correct answer</legend>
          {Array.from({ length: OPTION_SLOTS }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <input
                type="radio"
                name="correctIndex"
                value={i}
                defaultChecked={current?.correctIndex === i}
                aria-label={`Option ${i + 1} is correct`}
              />
              <input
                type="text"
                name={`option${i}`}
                defaultValue={currentOptions[i] ?? ""}
                placeholder={`Option ${i + 1}`}
                required={i < 2}
                style={{ flex: 1 }}
              />
            </div>
          ))}
        </fieldset>

        <label>
          Explanation (optional)
          <textarea name="explanation" rows={2} defaultValue={current?.explanation ?? ""} />
        </label>

        <button type="submit">Save as new version</button>
      </form>

      <h2 className="section-heading">Version history</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Question</th>
              <th>Author</th>
              <th>Created</th>
              <th style={{ textAlign: "right" }}>Used in</th>
            </tr>
          </thead>
          <tbody>
            {question.versions.map((v) => {
              const used = usageByVersion.get(v.id) ?? 0;
              return (
                <tr key={v.id}>
                  <td>
                    v{v.version} {v.isCurrent && <span className="pill">Current</span>}
                  </td>
                  <td>{v.questionText}</td>
                  <td className="muted">{v.authorEmail}</td>
                  <td>{v.createdAt.toLocaleDateString()}</td>
                  <td style={{ textAlign: "right" }}>
                    {used === 0 ? <span className="muted">—</span> : `${used} ${used === 1 ? "test" : "tests"}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
