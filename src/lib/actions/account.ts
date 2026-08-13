"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function setDesignationAction(formData: FormData) {
  const user = await requireUser();
  const designationId = String(formData.get("designationId") || "");
  if (!designationId) redirect("/account?error=" + encodeURIComponent("Pick a designation."));

  await prisma.designation.findUniqueOrThrow({ where: { id: designationId } });
  await prisma.user.update({ where: { id: user.id }, data: { designationId } });

  revalidatePath("/account");
  revalidatePath("/my-progress");
  redirect("/my-progress");
}
