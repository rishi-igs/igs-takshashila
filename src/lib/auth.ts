import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "lms_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function createSessionValue(userId: string): string {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionValue(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, sig] = parts;
  const expected = sign(`${userId}.${expires}`);
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) return null;
  if (Date.now() > Number(expires)) return null;
  return userId;
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionValue(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionValue(token);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId }, include: { designation: true } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Not authorized");
  return user;
}

// For use at the top of admin pages — sends the visitor somewhere sane
// instead of throwing into an error boundary.
export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

// Avoids visually ambiguous characters (0/O, 1/l/I) since this gets
// read off a screen and typed in by hand.
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTempPassword(length = 12): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return out;
}

const FLASH_CREDENTIALS_COOKIE = "lms_flash_credentials";

// Carries a just-generated password from the create-learner action to the
// confirmation page without putting it in the URL (browser history, server
// logs). Short-lived and scoped to /admin so it naturally disappears —
// cookies can only be *written* from a Server Action, not a page render, so
// this is read-only on the page side rather than delete-on-read.
export async function setFlashCredentials(email: string, password: string) {
  const jar = await cookies();
  jar.set(FLASH_CREDENTIALS_COOKIE, JSON.stringify({ email, password }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 90,
  });
}

export async function readFlashCredentials(): Promise<{ email: string; password: string } | null> {
  const jar = await cookies();
  const raw = jar.get(FLASH_CREDENTIALS_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
