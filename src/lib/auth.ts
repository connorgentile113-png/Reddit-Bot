import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "ff_session";

function secret(): string {
  return process.env.APP_SECRET || "dev-only-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(accountId: number): string {
  const payload = `${accountId}.${Date.now()}.${randomUUID()}`;
  return `${payload}.${sign(payload)}`;
}

function verify(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, ts, nonce, sig] = parts;
  const expected = sign(`${id}.${ts}.${nonce}`);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const age = Date.now() - parseInt(ts, 10);
  const dur = parseInt(process.env.SESSION_DURATION || "604800", 10) * 1000;
  if (age > dur) return null;
  return parseInt(id, 10);
}

export async function getSessionAccountId(): Promise<number | null> {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (!t) return null;
  return verify(t);
}

export async function setSessionCookie(accountId: number): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, createSessionToken(accountId), {
    httpOnly: true,
    path: "/",
    maxAge: parseInt(process.env.SESSION_DURATION || "604800", 10),
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Demo login — creates the local demo account on first use. */
export async function loginDemo(): Promise<void> {
  const res = await fetch(
    `${process.env.APP_URL || "http://localhost:3000"}/api/demo-login`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("demo login failed");
}
