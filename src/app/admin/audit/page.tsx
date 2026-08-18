import { requireAdminPage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AUDIT_ACTIONS, ANONYMOUS_ACTOR_NAME } from "@/lib/audit";

const PAGE_SIZE = 50;

// Grouped for the filter dropdown so the list stays readable as the action
// vocabulary grows.
const ACTION_GROUPS: { label: string; prefix: string }[] = [
  { label: "Sign-in activity", prefix: "auth." },
  { label: "Learner accounts", prefix: "learner." },
  { label: "Administrator accounts", prefix: "admin." },
  { label: "Assessments", prefix: "assessment." },
  { label: "Certificates", prefix: "certificate." },
  { label: "Question bank", prefix: "question." },
  { label: "Blueprints", prefix: "blueprint." },
  { label: "Catalog changes", prefix: "course." },
];

const ALL_ACTIONS = Object.values(AUDIT_ACTIONS);

function actionLabel(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; page?: string }>;
}) {
  await requireAdminPage();
  const { action, actor, page } = await searchParams;

  // Only accept an action we actually emit — otherwise the filter is a free
  // text field pointed straight at the database.
  const actionFilter = action && ALL_ACTIONS.includes(action as never) ? action : undefined;
  const actorFilter = actor?.trim() || undefined;
  const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);

  const where = {
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(actorFilter ? { actorEmail: { contains: actorFilter } } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (pageNum - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { action: actionFilter, actor: actorFilter, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  return (
    <>
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Audit log</h1>
      <p className="subtitle">
        Who did what, and when. Records are append-only and are kept even after the account that
        made the change is deleted.
      </p>

      <form className="filters" method="get">
        <label>
          Action
          <select name="action" defaultValue={actionFilter ?? ""}>
            <option value="">All actions</option>
            {ACTION_GROUPS.map((group) => {
              const inGroup = ALL_ACTIONS.filter((a) => a.startsWith(group.prefix));
              if (!inGroup.length) return null;
              return (
                <optgroup key={group.prefix} label={group.label}>
                  {inGroup.map((a) => (
                    <option key={a} value={a}>
                      {actionLabel(a)}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        <label>
          Actor email
          <input type="search" name="actor" defaultValue={actorFilter ?? ""} placeholder="name@igs.com" />
        </label>
        <button type="submit" className="button">
          Filter
        </button>
        {(actionFilter || actorFilter) && (
          <a href="/admin/audit" className="muted">
            Clear
          </a>
        )}
      </form>

      <p className="muted" style={{ marginTop: "1rem" }}>
        {total.toLocaleString()} {total === 1 ? "entry" : "entries"}
        {totalPages > 1 && ` — page ${pageNum} of ${totalPages}`}
      </p>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p>No audit entries match this filter.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>What happened</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div>{e.createdAt.toLocaleDateString()}</div>
                    <div className="muted" style={{ fontSize: "0.82rem" }}>
                      {e.createdAt.toLocaleTimeString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.actorName}</div>
                    <div className="muted" style={{ fontSize: "0.82rem" }}>
                      {e.actorEmail}
                      {/* A null actorId on a row that *did* have a real actor
                          means the account was deleted afterwards. On an
                          anonymous row it just means nobody was signed in. */}
                      {!e.actorId && e.actorName !== ANONYMOUS_ACTOR_NAME && " — account since removed"}
                    </div>
                  </td>
                  <td>
                    <span className="pill">{actionLabel(e.action)}</span>
                  </td>
                  <td>{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", alignItems: "center" }}>
          {pageNum > 1 && <a href={qs({ page: String(pageNum - 1) })}>← Newer</a>}
          {pageNum < totalPages && <a href={qs({ page: String(pageNum + 1) })}>Older →</a>}
        </div>
      )}
    </>
  );
}
