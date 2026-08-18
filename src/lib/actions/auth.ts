"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  getCurrentUser,
} from "@/lib/auth";
import { recordAudit, anonymousActor, AUDIT_ACTIONS } from "@/lib/audit";

function fail(page: "signup" | "login", message: string): never {
  redirect(`/${page}?error=${encodeURIComponent(message)}`);
}

// Signup only ever creates the first (admin) account — once any account
// exists, every learner is provisioned by an admin instead. See
// createLearnerAction in lib/actions/admin.ts.
export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();

  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  if (!email || !password || !name) fail("signup", "All fields are required.");
  if (password.length < 8) fail("signup", "Password must be at least 8 characters.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) fail("signup", "An account with that email already exists.");

  const { hash, salt } = hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      role: "ADMIN",
    },
  });

  await recordAudit(user, {
    action: AUDIT_ACTIONS.authSignup,
    entityType: "User",
    entityId: user.id,
    summary: `Bootstrapped the first administrator account (${email})`,
    meta: { email },
  });

  await setSessionCookie(user.id);
  redirect("/admin");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    // Recorded against the address that was tried, whether or not it exists.
    // The response to the user stays deliberately identical either way so
    // this log doesn't become an account-enumeration oracle.
    await recordAudit(anonymousActor(email), {
      action: AUDIT_ACTIONS.authLoginFailed,
      entityType: "User",
      entityId: user?.id ?? null,
      summary: `Failed sign-in attempt for ${email}`,
      meta: { accountExists: Boolean(user) },
    });
    fail("login", "Invalid email or password.");
  }

  await recordAudit(user, {
    action: AUDIT_ACTIONS.authLogin,
    entityType: "User",
    entityId: user.id,
    summary: `${user.name} signed in`,
  });

  await setSessionCookie(user.id);
  redirect(user.role === "ADMIN" ? "/admin" : "/my-progress");
}

export async function logoutAction() {
  // Read the session before clearing it — afterwards there's no actor left
  // to attribute the event to.
  const user = await getCurrentUser();
  if (user) {
    await recordAudit(user, {
      action: AUDIT_ACTIONS.authLogout,
      entityType: "User",
      entityId: user.id,
      summary: `${user.name} signed out`,
    });
  }

  await clearSessionCookie();
  redirect("/");
}
