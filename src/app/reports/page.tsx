import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";

export default async function ReportsPage() {
  await requireAdminPage();

  const [users, assignments, progress] = await Promise.all([
    prisma.user.findMany({ where: { designationId: { not: null } }, include: { designation: true } }),
    prisma.assignment.findMany({ include: { module: true } }),
    prisma.progress.findMany({ where: { status: "DONE" } }),
  ]);

  const assignmentsByDesignation = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = assignmentsByDesignation.get(a.designationId) ?? [];
    list.push(a);
    assignmentsByDesignation.set(a.designationId, list);
  }

  const doneAssignmentIdsByUser = new Map<string, Set<string>>();
  for (const p of progress) {
    const set = doneAssignmentIdsByUser.get(p.userId) ?? new Set<string>();
    set.add(p.assignmentId);
    doneAssignmentIdsByUser.set(p.userId, set);
  }

  // Per-learner completion
  const learnerRows = users.map((u) => {
    const total = assignmentsByDesignation.get(u.designationId!)?.length ?? 0;
    const done = doneAssignmentIdsByUser.get(u.id)?.size ?? 0;
    return {
      id: u.id,
      name: u.name,
      designation: u.designation!.name,
      total,
      done,
      pct: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });
  learnerRows.sort((a, b) => b.pct - a.pct);

  // Per-designation rollup (avg of enrolled learners)
  const byDesignation = new Map<string, { total: number; pctSum: number; learners: number }>();
  for (const row of learnerRows) {
    const agg = byDesignation.get(row.designation) ?? { total: 0, pctSum: 0, learners: 0 };
    agg.pctSum += row.pct;
    agg.learners += 1;
    byDesignation.set(row.designation, agg);
  }
  const designationRows = Array.from(byDesignation.entries())
    .map(([name, agg]) => ({ name, learners: agg.learners, avgPct: Math.round(agg.pctSum / agg.learners) }))
    .sort((a, b) => b.avgPct - a.avgPct);

  // Per-pillar rollup across all enrolled learners' assigned modules
  const pillarTotals = new Map<Pillar, { total: number; done: number }>();
  for (const u of users) {
    const userAssignments = assignmentsByDesignation.get(u.designationId!) ?? [];
    const doneIds = doneAssignmentIdsByUser.get(u.id) ?? new Set<string>();
    for (const a of userAssignments) {
      const agg = pillarTotals.get(a.module.pillar) ?? { total: 0, done: 0 };
      agg.total += 1;
      if (doneIds.has(a.id)) agg.done += 1;
      pillarTotals.set(a.module.pillar, agg);
    }
  }

  return (
    <>
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Reports</h1>
      <p className="subtitle">
        Completion across {users.length} learner{users.length === 1 ? "" : "s"} with a designation
        set.
      </p>

      <h2>By pillar</h2>
      {pillarTotals.size === 0 ? (
        <p className="empty-state">No enrolled learners yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pillar</th>
                <th>Modules done / assigned</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {PILLAR_ORDER.filter((p) => pillarTotals.has(p)).map((p) => {
                const agg = pillarTotals.get(p)!;
                const pct = agg.total === 0 ? 0 : Math.round((agg.done / agg.total) * 100);
                return (
                  <tr key={p}>
                    <td>{PILLAR_LABELS[p]}</td>
                    <td>
                      {agg.done} / {agg.total}
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <div className="progress-bar">
                        <div className="fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="muted" style={{ fontSize: "0.8rem" }}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2>By designation</h2>
      {designationRows.length === 0 ? (
        <p className="empty-state">No enrolled learners yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Designation</th>
                <th>Learners</th>
                <th>Avg completion</th>
              </tr>
            </thead>
            <tbody>
              {designationRows.map((d) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td>{d.learners}</td>
                  <td>{d.avgPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>By learner</h2>
      {learnerRows.length === 0 ? (
        <p className="empty-state">No learners have set a designation yet.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Designation</th>
                <th>Modules done / assigned</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {learnerRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.designation}</td>
                  <td>
                    {r.done} / {r.total}
                  </td>
                  <td>{r.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
