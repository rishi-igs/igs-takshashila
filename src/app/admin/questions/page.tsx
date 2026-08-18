import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import { activeCountsByPillar } from "@/lib/question-bank";
import { generateBankAction, bulkSetStatusAction } from "@/lib/actions/testops";
import type { Pillar, QuestionStatus } from "@/generated/prisma/enums";

const STATUSES: QuestionStatus[] = ["DRAFT", "ACTIVE", "RETIRED"];

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{
    pillar?: string;
    status?: string;
    generated?: string;
    skipped?: string;
    nodistractors?: string;
    bulk?: string;
    error?: string;
  }>;
}) {
  await requireAdminPage();
  const { pillar, status, generated, skipped, nodistractors, bulk, error } = await searchParams;

  const pillarFilter = PILLAR_ORDER.includes(pillar as Pillar) ? (pillar as Pillar) : undefined;
  const statusFilter = STATUSES.includes(status as QuestionStatus)
    ? (status as QuestionStatus)
    : undefined;

  const where = {
    ...(pillarFilter ? { pillar: pillarFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [questions, total, activeCounts, statusCounts] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        versions: { where: { isCurrent: true }, take: 1 },
        _count: { select: { versions: true } },
      },
    }),
    prisma.question.count({ where }),
    activeCountsByPillar(),
    prisma.question.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all]));

  return (
    <>
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Question bank</h1>
      <p className="subtitle">
        Editing a question creates a new version. Past tests keep the exact version they were
        graded against, so revisions never change a result that has already been issued.
      </p>

      <div className="stats-row">
        {STATUSES.map((s) => (
          <div className="stat" key={s}>
            <div className="value">{byStatus[s] ?? 0}</div>
            <div className="label">{s.charAt(0) + s.slice(1).toLowerCase()}</div>
          </div>
        ))}
      </div>

      <h2 className="section-heading">Active questions by pillar</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pillar</th>
              <th style={{ textAlign: "right" }}>Active</th>
            </tr>
          </thead>
          <tbody>
            {PILLAR_ORDER.map((p) => (
              <tr key={p}>
                <td>{PILLAR_LABELS[p]}</td>
                <td style={{ textAlign: "right" }}>{activeCounts[p] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {generated && (
        <p className="form-note">
          Generated {generated} draft {generated === "1" ? "question" : "questions"} from the
          curriculum. {skipped && skipped !== "0" && `${skipped} already existed and were skipped. `}
          {nodistractors && nodistractors !== "0" && `${nodistractors} were skipped for lack of plausible wrong answers. `}
          Review and approve them below — drafts are never selected for a test.
        </p>
      )}
      {bulk && <p className="form-note">Updated {bulk} questions.</p>}
      {error && <p className="form-error">{error}</p>}

      <h2 className="section-heading">Generate from curriculum</h2>
      <p className="muted">
        Builds questions automatically from your 396 modules — what a module covers, the standard
        it requires, and which pillar it belongs to. Everything lands as a <strong>draft</strong>.
        Safe to re-run: existing entries are skipped, so this also tops the bank up after new
        modules are added.
      </p>
      <form action={generateBankAction} className="filters">
        <label>
          Scope
          <select name="pillar" defaultValue="">
            <option value="">All pillars</option>
            {PILLAR_ORDER.map((p) => (
              <option key={p} value={p}>
                {PILLAR_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button">
          Generate drafts
        </button>
      </form>

      <h2 className="section-heading">Bulk review</h2>
      <p className="muted">
        Approve or retire a whole pillar at once — the bank runs to hundreds of questions, so
        reviewing row by row isn&apos;t practical.
      </p>
      <form action={bulkSetStatusAction} className="filters">
        <label>
          Pillar
          <select name="pillar" defaultValue="">
            <option value="">All pillars</option>
            {PILLAR_ORDER.map((p) => (
              <option key={p} value={p}>
                {PILLAR_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Currently
          <select name="fromStatus" defaultValue="DRAFT">
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label>
          Set to
          <select name="status" defaultValue="ACTIVE">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button">
          Apply
        </button>
      </form>

      <div style={{ marginTop: "1.5rem" }}>
        <Link href="/admin/questions/new" className="button">
          + Write a question
        </Link>
      </div>

      <form className="filters" method="get" style={{ marginTop: "1.5rem" }}>
        <label>
          Pillar
          <select name="pillar" defaultValue={pillarFilter ?? ""}>
            <option value="">All pillars</option>
            {PILLAR_ORDER.map((p) => (
              <option key={p} value={p}>
                {PILLAR_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={statusFilter ?? ""}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="button">
          Filter
        </button>
        {(pillarFilter || statusFilter) && (
          <Link href="/admin/questions" className="muted">
            Clear
          </Link>
        )}
      </form>

      <p className="muted" style={{ marginTop: "1rem" }}>
        {total.toLocaleString()} {total === 1 ? "question" : "questions"}
        {total > 100 && " — showing the 100 most recently updated"}
      </p>

      {questions.length === 0 ? (
        <div className="empty-state">
          <p>No questions yet. Write the first one to start building the bank.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Pillar</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Versions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {q.versions[0]?.questionText ?? <span className="muted">(no version)</span>}
                    </div>
                    {q.moduleCode && (
                      <div className="muted" style={{ fontSize: "0.82rem" }}>
                        Module {q.moduleCode}
                      </div>
                    )}
                  </td>
                  <td>{PILLAR_LABELS[q.pillar]}</td>
                  <td>
                    <span className="pill">{q.status.charAt(0) + q.status.slice(1).toLowerCase()}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>{q._count.versions}</td>
                  <td>
                    <Link href={`/admin/questions/${q.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
