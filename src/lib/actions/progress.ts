"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const VALID_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS", "DONE"]);

export async function setProgressAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = String(formData.get("assignmentId") || "");
  const status = String(formData.get("status") || "");
  if (!assignmentId || !VALID_STATUSES.has(status)) return;

  await prisma.progress.upsert({
    where: { userId_assignmentId: { userId: user.id, assignmentId } },
    create: {
      userId: user.id,
      assignmentId,
      status: status as "NOT_STARTED" | "IN_PROGRESS" | "DONE",
      completedAt: status === "DONE" ? new Date() : null,
    },
    update: {
      status: status as "NOT_STARTED" | "IN_PROGRESS" | "DONE",
      completedAt: status === "DONE" ? new Date() : null,
    },
  });

  revalidatePath("/my-progress");
  revalidatePath("/curriculum/[slug]", "page");
}
