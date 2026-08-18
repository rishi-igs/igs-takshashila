import { requireAdminPage } from "@/lib/auth";

type Access = "yes" | "no" | "own" | "redirect";

type Capability = {
  capability: string;
  where: string;
  anon: Access;
  learner: Access;
  admin: Access;
  note?: string;
};

// This table mirrors the guards actually enforced in the code — page-level
// requireAdminPage/getCurrentUser checks and the ownership tests inside each
// server action. It is maintained by hand: when a guard changes, change the
// row too, or this page quietly becomes a lie.
const CAPABILITIES: Capability[] = [
  {
    capability: "View the landing page",
    where: "/",
    anon: "yes",
    learner: "yes",
    admin: "yes",
  },
  {
    capability: "Browse all designations / role explorer",
    where: "/curriculum",
    anon: "yes",
    learner: "redirect",
    admin: "yes",
    note: "Learners are sent to /my-progress — their own curriculum, with editing built in.",
  },
  {
    capability: "Browse the course library",
    where: "/courses",
    anon: "yes",
    learner: "redirect",
    admin: "yes",
    note: "Same redirect rule as the role explorer.",
  },
  {
    capability: "View own curriculum and progress",
    where: "/my-progress",
    anon: "no",
    learner: "own",
    admin: "own",
  },
  {
    capability: "Self-report course completion",
    where: "setProgressAction",
    anon: "no",
    learner: "own",
    admin: "own",
    note: "Progress rows are keyed to the caller's own user id; there is no way to write another learner's row.",
  },
  {
    capability: "Choose own designation",
    where: "/account",
    anon: "no",
    learner: "own",
    admin: "own",
    note: "One-time only — once set, it can't be changed from here.",
  },
  {
    capability: "Sit an assigned assessment",
    where: "/assessment",
    anon: "no",
    learner: "own",
    admin: "own",
    note: "Start, event-log and submit actions all verify assessment.learnerId matches the caller.",
  },
  {
    capability: "View a certificate",
    where: "/certificate/[id]",
    anon: "no",
    learner: "own",
    admin: "yes",
    note: "Learners see only their own; admins see any. Anything else 404s.",
  },
  {
    capability: "Admin console",
    where: "/admin",
    anon: "no",
    learner: "no",
    admin: "yes",
  },
  {
    capability: "Create learner accounts / enrol into a designation",
    where: "/admin/learners/new",
    anon: "no",
    learner: "no",
    admin: "yes",
  },
  {
    capability: "View any learner's record and progress",
    where: "/admin/learners/[id]",
    anon: "no",
    learner: "no",
    admin: "yes",
  },
  {
    capability: "Create or remove administrators",
    where: "/admin/admins",
    anon: "no",
    learner: "no",
    admin: "yes",
    note: "An admin can't delete their own account, and the last remaining admin can't be removed.",
  },
  {
    capability: "Send an assessment",
    where: "createAssessmentAction",
    anon: "no",
    learner: "no",
    admin: "yes",
    note: "Only once the learner has completed every assignment in their curriculum.",
  },
  {
    capability: "Issue a certificate",
    where: "issueCertificateAction",
    anon: "no",
    learner: "no",
    admin: "yes",
    note: "Requires a submitted assessment at or above the pass mark, and one per assessment.",
  },
  {
    capability: "Edit the course catalog",
    where: "/admin/courses",
    anon: "no",
    learner: "no",
    admin: "yes",
  },
  {
    capability: "Create designations, modules, assignments",
    where: "/admin/*/new",
    anon: "no",
    learner: "no",
    admin: "yes",
  },
  {
    capability: "View reports",
    where: "/reports",
    anon: "no",
    learner: "no",
    admin: "yes",
  },
  {
    capability: "Read the audit log",
    where: "/admin/audit",
    anon: "no",
    learner: "no",
    admin: "yes",
  },
];

// Uses the existing theme tokens so the matrix stays legible in both themes.
const CELL: Record<Access, { mark: string; label: string; color: string }> = {
  yes: { mark: "✓", label: "Full access", color: "var(--teal)" },
  own: { mark: "◑", label: "Own records only", color: "var(--amber)" },
  redirect: { mark: "→", label: "Redirected elsewhere", color: "var(--muted)" },
  no: { mark: "✕", label: "No access", color: "var(--error-fg)" },
};

// The glyph alone would leave the meaning to colour and shape, so the label
// is always in the accessibility tree as text.
function Cell({ access }: { access: Access }) {
  const c = CELL[access];
  return (
    <td style={{ textAlign: "center" }}>
      <span aria-hidden="true" style={{ color: c.color, fontWeight: 700 }}>
        {c.mark}
      </span>
      <span className="sr-only">{c.label}</span>
    </td>
  );
}

export default async function PermissionMatrixPage() {
  await requireAdminPage();

  return (
    <>
      <a href="/admin" className="muted">
        ← Admin
      </a>
      <h1>Permission matrix</h1>
      <p className="subtitle">
        What each role can do, and whose records they can see. The system has two roles —{" "}
        <strong>Learner</strong> and <strong>Administrator</strong> — plus signed-out visitors.
      </p>

      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
          margin: "1.5rem 0",
          fontSize: "0.9rem",
        }}
      >
        {(Object.keys(CELL) as Access[]).map((k) => (
          <span key={k}>
            <span aria-hidden="true" style={{ color: CELL[k].color, fontWeight: 700, marginRight: "0.4rem" }}>
              {CELL[k].mark}
            </span>
            {CELL[k].label}
          </span>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th style={{ textAlign: "center" }}>Signed out</th>
              <th style={{ textAlign: "center" }}>Learner</th>
              <th style={{ textAlign: "center" }}>Admin</th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((c) => (
              <tr key={c.capability}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.capability}</div>
                  <div className="muted" style={{ fontSize: "0.82rem" }}>
                    <code>{c.where}</code>
                  </div>
                  {c.note && (
                    <div className="muted" style={{ fontSize: "0.82rem", marginTop: "0.25rem" }}>
                      {c.note}
                    </div>
                  )}
                </td>
                <Cell access={c.anon} />
                <Cell access={c.learner} />
                <Cell access={c.admin} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
