"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword, generateTempPassword, setFlashCredentials } from "@/lib/auth";
import { generateAssessmentQuestions } from "@/lib/assessment-generator";
import { resolveBlueprint } from "@/lib/blueprint";
import { selectFromBank, BankShortfallError } from "@/lib/bank-selection";
import { CERTIFICATE_PASS_SCORE } from "@/lib/certificate";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { openEnrolment } from "@/lib/enrolment";
import type { Pillar } from "@/generated/prisma/enums";

function generateCertificateNumber(): string {
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `IGS-${new Date().getFullYear()}-${random}`;
}

export async function issueCertificateAction(formData: FormData) {
  const admin = await requireAdmin();
  const learnerId = String(formData.get("learnerId") || "");

  const learner = await prisma.user.findUnique({ where: { id: learnerId }, include: { designation: true } });
  if (!learner || learner.role !== "LEARNER" || !learner.designation) {
    redirect("/admin/learners?error=" + encodeURIComponent("Learner not found or has no designation."));
  }

  const latestAssessment = await prisma.assessment.findFirst({
    where: { learnerId, status: "SUBMITTED" },
    orderBy: { createdAt: "desc" },
    include: { certificate: true },
  });

  if (!latestAssessment || (latestAssessment.score ?? 0) < CERTIFICATE_PASS_SCORE) {
    redirect(`/admin/learners/${learnerId}?error=` + encodeURIComponent(`Learner needs a score of at least ${CERTIFICATE_PASS_SCORE} to qualify.`));
  }
  if (latestAssessment.certificate) {
    redirect(`/admin/learners/${learnerId}?error=` + encodeURIComponent("A certificate was already issued for this assessment."));
  }

  let certificateNumber = generateCertificateNumber();
  for (let attempt = 0; attempt < 3; attempt++) {
    const clash = await prisma.certificate.findUnique({ where: { certificateNumber } });
    if (!clash) break;
    certificateNumber = generateCertificateNumber();
  }

  const certificate = await prisma.certificate.create({
    data: {
      learnerId,
      assessmentId: latestAssessment.id,
      issuedById: admin.id,
      certificateNumber,
      learnerName: learner.name,
      designationName: learner.designation.name,
      score: latestAssessment.score ?? 0,
      totalQuestions: latestAssessment.totalQuestions,
    },
  });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.certificateIssue,
    entityType: "Certificate",
    entityId: certificate.id,
    summary: `Issued certificate ${certificate.certificateNumber} to ${learner.name} (${learner.designation.name}) — scored ${certificate.score}/${certificate.totalQuestions}`,
    meta: {
      learnerId,
      assessmentId: latestAssessment.id,
      certificateNumber: certificate.certificateNumber,
      score: certificate.score,
      totalQuestions: certificate.totalQuestions,
    },
  });

  revalidatePath("/admin/learners");
  revalidatePath(`/admin/learners/${learnerId}`);
  redirect(`/admin/learners/${learnerId}?certificateIssued=${certificate.id}`);
}

export async function createAssessmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const learnerId = String(formData.get("learnerId") || "");

  const learner = await prisma.user.findUnique({ where: { id: learnerId } });
  if (!learner || learner.role !== "LEARNER" || !learner.designationId) {
    redirect("/admin/learners?error=" + encodeURIComponent("Learner not found or has no designation."));
  }

  const existingActive = await prisma.assessment.findFirst({
    where: { learnerId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
  });
  if (existingActive) {
    redirect(`/admin/learners/${learnerId}?error=` + encodeURIComponent("This learner already has a pending assessment."));
  }

  const [total, done] = await Promise.all([
    prisma.assignment.count({ where: { designationId: learner.designationId } }),
    prisma.progress.count({
      where: { userId: learnerId, status: "DONE", assignment: { designationId: learner.designationId } },
    }),
  ]);
  if (total === 0 || done < total) {
    redirect(`/admin/learners/${learnerId}?error=` + encodeURIComponent("Learner hasn't completed their curriculum yet."));
  }

  // Preferred path: draw from the approved bank using the designation's
  // blueprint, so quotas and bank health actually govern what gets sent.
  // If no blueprint is configured at all, fall back to generating from the
  // curriculum directly — that keeps a fresh install working before anyone
  // has set up the bank, rather than blocking assessments entirely.
  let questions: {
    order: number;
    questionText: string;
    options: string[];
    correctIndex: number;
    sourceModuleCode: string;
    questionVersionId?: string;
  }[];
  let source: string;
  let durationMinutes = 20;

  const blueprint = await resolveBlueprint(learner.designationId);
  if (blueprint) {
    try {
      const picked = await selectFromBank(learner.designationId);
      questions = picked.questions;
      durationMinutes = picked.durationMinutes;
      source = `blueprint "${picked.blueprintName}"`;
    } catch (e) {
      if (e instanceof BankShortfallError) {
        redirect(`/admin/learners/${learnerId}?error=` + encodeURIComponent(e.message));
      }
      throw e;
    }
  } else {
    questions = await generateAssessmentQuestions(learner.designationId, 25);
    source = "curriculum (no blueprint configured)";
    if (questions.length < 5) {
      redirect(`/admin/learners/${learnerId}?error=` + encodeURIComponent("Not enough curriculum content to build an assessment."));
    }
  }

  const assessment = await prisma.assessment.create({
    data: {
      learnerId,
      assignedById: admin.id,
      totalQuestions: questions.length,
      durationMinutes,
      questions: {
        create: questions.map((q) => ({
          order: q.order,
          questionText: q.questionText,
          optionsJson: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          sourceModuleCode: q.sourceModuleCode,
          questionVersionId: q.questionVersionId ?? null,
        })),
      },
    },
  });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.assessmentCreate,
    entityType: "Assessment",
    entityId: assessment.id,
    summary: `Sent a ${questions.length}-question assessment to ${learner.name} from ${source}`,
    meta: { learnerId, totalQuestions: questions.length, source, durationMinutes },
  });

  revalidatePath(`/admin/learners/${learnerId}`);
  revalidatePath("/admin/learners");
  redirect(`/admin/learners/${learnerId}?assessmentSent=1`);
}

export async function createLearnerAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const designationId = String(formData.get("designationId") || "").trim();

  if (!name || !email) {
    redirect("/admin/learners/new?error=" + encodeURIComponent("Name and email are required."));
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(
      "/admin/learners/new?error=" + encodeURIComponent("An account with that email already exists.")
    );
  }

  const password = generateTempPassword();
  const { hash, salt } = hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      role: "LEARNER",
    },
  });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.learnerCreate,
    entityType: "User",
    entityId: user.id,
    summary: `Created learner account for ${name} (${email})`,
    meta: { email, designationId: designationId || null },
  });

  // Designation is applied through openEnrolment rather than set inline on
  // create, so the learner's tenure history starts from day one.
  if (designationId) {
    await openEnrolment(user.id, designationId, "Set at account creation");
    await recordAudit(admin, {
      action: AUDIT_ACTIONS.learnerEnrol,
      entityType: "User",
      entityId: user.id,
      summary: `Enrolled ${name} in ${designationId}`,
      meta: { designationId },
    });
  }

  await setFlashCredentials(email, password);
  revalidatePath("/admin/learners");
  redirect(`/admin/learners/${user.id}?created=1`);
}

export async function createAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!name || !email) {
    redirect("/admin/admins/new?error=" + encodeURIComponent("Name and email are required."));
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(
      "/admin/admins/new?error=" + encodeURIComponent("An account with that email already exists.")
    );
  }

  const password = generateTempPassword();
  const { hash, salt } = hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      role: "ADMIN",
    },
  });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.adminCreate,
    entityType: "User",
    entityId: user.id,
    summary: `Created administrator account for ${name} (${email})`,
    meta: { email },
  });

  await setFlashCredentials(email, password);
  revalidatePath("/admin/admins");
  redirect(`/admin/admins/${user.id}?created=1`);
}

export async function deleteAdminAction(formData: FormData) {
  const admin = await requireAdmin();
  const targetId = String(formData.get("adminId") || "");

  if (targetId === admin.id) {
    redirect(`/admin/admins/${targetId}?error=` + encodeURIComponent("You can't delete your own account."));
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target || target.role !== "ADMIN") {
    redirect("/admin/admins?error=" + encodeURIComponent("Administrator not found."));
  }

  const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
  if (adminCount <= 1) {
    redirect(
      `/admin/admins/${targetId}?error=` +
        encodeURIComponent("Can't delete the last remaining administrator.")
    );
  }

  await prisma.user.delete({ where: { id: targetId } });

  // Written after the delete succeeds so the log records what actually
  // happened. AuditLog has no FK to User, so removing the account does not
  // touch this row or any row describing what that account did.
  await recordAudit(admin, {
    action: AUDIT_ACTIONS.adminDelete,
    entityType: "User",
    entityId: targetId,
    summary: `Removed administrator ${target.name} (${target.email})`,
    meta: { email: target.email, remainingAdmins: adminCount - 1 },
  });

  revalidatePath("/admin/admins");
  redirect("/admin/admins?deleted=1");
}

export async function updateCourseAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const directLink = String(formData.get("directLink") || "").trim();
  const validationStatus = String(formData.get("validationStatus") || "").trim();
  const qualityNote = String(formData.get("qualityNote") || "").trim();

  // Read the current row first so the audit entry can record what changed,
  // not just that something did — "validation NOT_CHECKED → VERIFIED" is the
  // detail a dispute actually turns on.
  const before = await prisma.course.findUnique({ where: { id } });
  if (!before) {
    redirect("/admin/courses?error=" + encodeURIComponent("Course not found."));
  }

  await prisma.course.update({
    where: { id },
    data: {
      directLink: directLink || null,
      validationStatus,
      qualityNote: qualityNote || null,
    },
  });

  const changes: string[] = [];
  if ((before.directLink ?? "") !== directLink) changes.push("link");
  if (before.validationStatus !== validationStatus) {
    changes.push(`validation ${before.validationStatus} → ${validationStatus}`);
  }
  if ((before.qualityNote ?? "") !== qualityNote) changes.push("quality note");

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.courseUpdate,
    entityType: "Course",
    entityId: id,
    summary: changes.length
      ? `Updated course "${before.name}" — ${changes.join(", ")}`
      : `Saved course "${before.name}" with no changes`,
    meta: {
      before: {
        directLink: before.directLink,
        validationStatus: before.validationStatus,
        qualityNote: before.qualityNote,
      },
      after: { directLink: directLink || null, validationStatus, qualityNote: qualityNote || null },
    },
  });

  revalidatePath("/admin/courses");
  revalidatePath("/courses");
  redirect("/admin/courses?saved=1");
}

export async function createDesignationAction(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const roleStage = String(formData.get("roleStage") || "").trim();
  const jobFamily = String(formData.get("jobFamily") || "").trim();

  if (!name || !roleStage || !jobFamily) {
    redirect("/admin/designations/new?error=" + encodeURIComponent("All fields are required."));
  }

  const existing = await prisma.designation.findUnique({ where: { name } });
  if (existing) {
    redirect(
      "/admin/designations/new?error=" +
        encodeURIComponent("A designation with that name already exists.")
    );
  }

  await prisma.designation.create({ data: { id: name, name, roleStage, jobFamily } });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.designationCreate,
    entityType: "Designation",
    entityId: name,
    summary: `Created designation "${name}" (${roleStage}, ${jobFamily})`,
    meta: { roleStage, jobFamily },
  });

  revalidatePath("/");
  redirect("/admin?saved=designation");
}

export async function createModuleAction(formData: FormData) {
  const admin = await requireAdmin();
  const code = String(formData.get("code") || "").trim();
  const pillar = String(formData.get("pillar") || "") as Pillar;
  const name = String(formData.get("name") || "").trim();
  const capabilityTopics = String(formData.get("capabilityTopics") || "").trim();
  const practicalOutput = String(formData.get("practicalOutput") || "").trim();
  const standard = String(formData.get("standard") || "").trim();

  if (!code || !pillar || !name) {
    redirect("/admin/modules/new?error=" + encodeURIComponent("Code, pillar and name are required."));
  }

  const existing = await prisma.module.findUnique({ where: { code } });
  if (existing) {
    redirect(
      "/admin/modules/new?error=" + encodeURIComponent("A module with that code already exists.")
    );
  }

  await prisma.module.create({
    data: { code, pillar, name, capabilityTopics, practicalOutput, standard },
  });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.moduleCreate,
    entityType: "Module",
    entityId: code,
    summary: `Created module ${code} — "${name}" (${pillar})`,
    meta: { pillar },
  });

  redirect("/admin?saved=module");
}

export async function createAssignmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const designationId = String(formData.get("designationId") || "");
  const moduleCode = String(formData.get("moduleCode") || "");
  const requirement = String(formData.get("requirement") || "").trim();
  const hours = parseInt(String(formData.get("hours") || "0"), 10) || 0;

  if (!designationId || !moduleCode || !requirement) {
    redirect(
      "/admin/assignments/new?error=" +
        encodeURIComponent("Designation, module and requirement are required.")
    );
  }

  const existing = await prisma.assignment.findFirst({ where: { designationId, moduleCode } });
  if (existing) {
    redirect(
      "/admin/assignments/new?error=" +
        encodeURIComponent("This designation is already assigned that module.")
    );
  }

  const assignment = await prisma.assignment.create({
    data: {
      designationId,
      moduleCode,
      requirement,
      hours,
      freeLearning: String(formData.get("freeLearning") || "").trim() || null,
      freeLink: String(formData.get("freeLink") || "").trim() || null,
      premiumLearning: String(formData.get("premiumLearning") || "").trim() || null,
      premiumLink: String(formData.get("premiumLink") || "").trim() || null,
    },
  });

  await recordAudit(admin, {
    action: AUDIT_ACTIONS.assignmentCreate,
    entityType: "Assignment",
    entityId: assignment.id,
    summary: `Assigned module ${moduleCode} to ${designationId} (${requirement}, ${hours}h)`,
    meta: { designationId, moduleCode, requirement, hours },
  });

  revalidatePath("/curriculum/[slug]", "page");
  redirect("/admin?saved=assignment");
}
