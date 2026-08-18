import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import { createQuestionAction } from "@/lib/actions/testops";

const OPTION_SLOTS = 4;

export default async function NewQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdminPage();
  const { error } = await searchParams;

  const modules = await prisma.module.findMany({
    orderBy: { code: "asc" },
    select: { code: true, name: true },
    take: 500,
  });

  return (
    <>
      <Link href="/admin/questions" className="muted">
        ← Question bank
      </Link>
      <h1>Write a question</h1>
      <p className="subtitle">
        This becomes version 1. Later edits append new versions rather than changing this one.
      </p>

      {error && <p className="form-error">{error}</p>}

      <form action={createQuestionAction} className="auth-form" style={{ maxWidth: "44rem" }}>
        <label>
          Question text
          <textarea name="questionText" rows={3} required />
        </label>

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem" }}>
          <legend>Options — select the correct answer</legend>
          {Array.from({ length: OPTION_SLOTS }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <input
                type="radio"
                name="correctIndex"
                value={i}
                id={`correct-${i}`}
                defaultChecked={i === 0}
                aria-label={`Option ${i + 1} is correct`}
              />
              <input
                type="text"
                name={`option${i}`}
                placeholder={`Option ${i + 1}${i < 2 ? " (required)" : ""}`}
                required={i < 2}
                style={{ flex: 1 }}
              />
            </div>
          ))}
          <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
            Leave trailing options blank for a shorter question. Two options minimum.
          </p>
        </fieldset>

        <label>
          Pillar
          <select name="pillar" required defaultValue="">
            <option value="" disabled>
              Choose a pillar
            </option>
            {PILLAR_ORDER.map((p) => (
              <option key={p} value={p}>
                {PILLAR_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Module (optional)
          <select name="moduleCode" defaultValue="">
            <option value="">Not tied to a specific module</option>
            {modules.map((m) => (
              <option key={m.code} value={m.code}>
                {m.code} — {m.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Explanation (optional)
          <textarea name="explanation" rows={2} placeholder="Why the correct answer is correct" />
        </label>

        <label>
          Status
          <select name="status" defaultValue="DRAFT">
            <option value="DRAFT">Draft — not selectable for tests yet</option>
            <option value="ACTIVE">Active — eligible for selection</option>
          </select>
        </label>

        <button type="submit">Create question</button>
      </form>
    </>
  );
}
