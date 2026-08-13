"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword, generateTempPassword, setFlashCredentials } from "@/lib/auth";
import { generateAssessmentQuestions } from "@/lib/assessment-generator";
import { CERTIFICATE_PASS_SCORE } from "@/lib/certificate";
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

  const questions = await generateAssessmentQuestions(learner.designationId, 25);
  if (questions.length < 5) {
    redirect(`/admin/learners/${learnerId}?error=` + encodeURIComponent("Not enough curriculum content to build an assessment."));
  }

  await prisma.assessment.create({
    data: {
      learnerId,
      assignedById: admin.id,
      totalQuestions: questions.length,
      questions: {
        create: questions.map((q) => ({
          order: q.order,
          questionText: q.questionText,
          optionsJson: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          sourceModuleCode: q.sourceModuleCode,
        })),
      },
    },
  });

  revalidatePath(`/admin/learners/${learnerId}`);
  revalidatePath("/admin/learners");
  redirect(`/admin/learners/${learnerId}?assessmentSent=1`);
}

export async function createLearnerAction(formData: FormData) {
  await requireAdmin();
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
      designationId: designationId || null,
    },
  });

  await setFlashCredentials(email, password);
  revalidatePath("/admin/learners");
  redirect(`/admin/learners/${user.id}?created=1`);
}

export async function updateCourseAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const directLink = String(formData.get("directLink") || "").trim();
  const validationStatus = String(formData.get("validationStatus") || "").trim();
  const qualityNote = String(formData.get("qualityNote") || "").trim();

  await prisma.course.update({
    where: { id },
    data: {
      directLink: directLink || null,
      validationStatus,
      qualityNote: qualityNote || null,
    },
  });

  revalidatePath("/admin/courses");
  revalidatePath("/courses");
  redirect("/admin/courses?saved=1");
}

export async function createDesignationAction(formData: FormData) {
  await requireAdmin();
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
  revalidatePath("/");
  redirect("/admin?saved=designation");
}

export async function createModuleAction(formData: FormData) {
  await requireAdmin();
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
  redirect("/admin?saved=module");
}

export async function createAssignmentAction(formData: FormData) {
  await requireAdmin();
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

  await prisma.assignment.create({
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

  revalidatePath("/curriculum/[slug]", "page");
  redirect("/admin?saved=assignment");
}
