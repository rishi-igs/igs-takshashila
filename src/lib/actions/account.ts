"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { openEnrolment } from "@/lib/enrolment";

export async function setDesignationAction(formData: FormData) {
  const user = await requireUser();

  // Once a designation is set — by the learner or by an admin at creation —
  // it's fixed. Only an admin changing it directly in the database can move
  // a learner between designations from here on.
  if (user.designationId) {
    redirect("/account?error=" + encodeURIComponent("Your designation is already set and can't be changed."));
  }

  const designationId = String(formData.get("designationId") || "");
  if (!designationId) redirect("/account?error=" + encodeURIComponent("Pick a designation."));

  const designation = await prisma.designation.findUniqueOrThrow({ where: { id: designationId } });

  // openEnrolment sets user.designationId and opens the dated tenure record
  // in one transaction.
  await openEnrolment(user.id, designationId, "Chosen by the learner");

  await recordAudit(user, {
    action: AUDIT_ACTIONS.learnerEnrol,
    entityType: "User",
    entityId: user.id,
    summary: `${user.name} enrolled in ${designation.name}`,
    meta: { designationId },
  });

  revalidatePath("/account");
  revalidatePath("/my-progress");
  redirect("/my-progress");
}
