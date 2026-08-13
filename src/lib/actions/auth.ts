"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie } from "@/lib/auth";

function fail(page: "signup" | "login", message: string): never {
  redirect(`/${page}?error=${encodeURIComponent(message)}`);
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();

  if (!email || !password || !name) fail("signup", "All fields are required.");
  if (password.length < 8) fail("signup", "Password must be at least 8 characters.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) fail("signup", "An account with that email already exists.");

  const userCount = await prisma.user.count();
  const { hash, salt } = hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      // First account in the system becomes admin — there's no seeded admin otherwise.
      role: userCount === 0 ? "ADMIN" : "LEARNER",
    },
  });

  await setSessionCookie(user.id);
  redirect("/account");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    fail("login", "Invalid email or password.");
  }

  await setSessionCookie(user.id);
  redirect("/my-progress");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/");
}
