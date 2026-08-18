import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

// The actor shape every audit write needs. Both requireAdmin() and
// requireUser() return a User, which satisfies this structurally.
//
// id is nullable so unauthenticated events — a failed sign-in against an
// address that may not even exist — can still be recorded against the
// address that was tried.
type Actor = {
  id: string | null;
  email: string;
  name: string;
  role: Role;
};

// A null actorId means one of two different things — the actor's account was
// deleted after the fact, or there was never an authenticated user at all
// (a failed sign-in). This sentinel name is what tells the two apart when
// the log is read back.
export const ANONYMOUS_ACTOR_NAME = "(unauthenticated)";

// Stand-in actor for events with no authenticated user behind them.
export function anonymousActor(email: string): Actor {
  return { id: null, email, name: ANONYMOUS_ACTOR_NAME, role: "LEARNER" };
}

type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
};

// Actions are dot-namespaced so the log can be filtered by prefix
// ("learner.", "admin.") and so the set of verbs stays a closed vocabulary
// rather than drifting into free text at each call site.
export const AUDIT_ACTIONS = {
  authLogin: "auth.login",
  authLoginFailed: "auth.login_failed",
  authLogout: "auth.logout",
  authSignup: "auth.signup",
  learnerCreate: "learner.create",
  learnerEnrol: "learner.enrol",
  adminCreate: "admin.create",
  adminDelete: "admin.delete",
  assessmentCreate: "assessment.create",
  assessmentRegrade: "assessment.regrade",
  certificateIssue: "certificate.issue",
  questionCreate: "question.create",
  questionRevise: "question.revise",
  questionStatus: "question.status",
  questionGenerate: "question.generate",
  questionBulkStatus: "question.bulk_status",
  blueprintCreate: "blueprint.create",
  courseUpdate: "course.update",
  designationCreate: "designation.create",
  moduleCreate: "module.create",
  assignmentCreate: "assignment.create",
} as const;

/**
 * Append one entry to the audit trail.
 *
 * Actor identity is snapshotted (email, name, role) rather than joined at
 * read time, so the record still reads correctly after the actor is renamed
 * or deleted — see the AuditLog model comment.
 *
 * Errors are intentionally NOT swallowed. This writes to the same SQLite
 * database as the operation being audited, so a failure here means that
 * write is in trouble too; silently dropping the record would leave the log
 * quietly incomplete, which is the one thing an audit trail must never be.
 *
 * Call this *before* any redirect() — redirect throws internally, so
 * anything after it is unreachable.
 */
export async function recordAudit(actor: Actor, entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: actor.id ?? null,
      actorEmail: actor.email,
      actorName: actor.name,
      actorRole: actor.role,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      metaJson: entry.meta ? JSON.stringify(entry.meta) : null,
    },
  });
}
