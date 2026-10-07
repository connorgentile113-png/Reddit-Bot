import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "crypto";
import { getDb } from "@/lib/db";
import { ensureTables, seedDemo } from "@/lib/ensure";
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionAccountId,
} from "@/lib/auth";

const hashPw = (pw: string) =>
  scryptSync(pw, randomBytes(16).toString("hex"), 64).toString("hex");

export async function POST(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";

  try {
    if (action === "demo-login") {
      const db = getDb();
      await ensureTables(db);
      let user = (await db`SELECT id FROM accounts WHERE username = 'demo-user' LIMIT 1`)[0] as { id: number } | undefined;
      if (!user) {
        user = (await db`
          INSERT INTO accounts (username, auth_type) VALUES ('demo-user', 'demo') RETURNING id
        `)[0] as { id: number };
      }
      const s = (await db`SELECT 1 FROM schedules WHERE account_id = ${user.id} LIMIT 1`).length;
      if (!s) {
        await db`INSERT INTO schedules (account_id) VALUES (${user.id})`;
      }
      await seedDemo(user.id, db);
      await setSessionCookie(user.id);
      return NextResponse.json({ ok: true, username: "demo-user" });
    }

    if (!username || !password) {
      return NextResponse.json({ error: "username and password required" }, { status: 400 });
    }

    if (action === "register") {
      const db = getDb();
      await ensureTables(db);
      const exists = await db`SELECT 1 FROM accounts WHERE LOWER(username) = ${username} LIMIT 1`;
      if (exists.length) {
        return NextResponse.json({ error: "username already taken" }, { status: 409 });
      }
      const rows = await db`
        INSERT INTO accounts (username, password_hash, auth_type)
        VALUES (${username}, ${hashPw(password)}, 'demo') RETURNING id
      `;
      const user = rows[0] as { id: number };
      await db`INSERT INTO schedules (account_id) VALUES (${user.id})`;
      await setSessionCookie(user.id);
      return NextResponse.json({ ok: true, username });
    }

    // login
    const db = getDb();
    await ensureTables(db);
    const user = (
      await db`SELECT id, password_hash FROM accounts WHERE LOWER(username) = ${username} LIMIT 1`
    )[0] as { id: number; password_hash: string } | undefined;
    if (!user) return NextResponse.json({ error: "wrong username or password" }, { status: 401 });
    if (hashPw(password) !== user.password_hash) {
      return NextResponse.json({ error: "wrong username or password" }, { status: 401 });
    }
    await setSessionCookie(user.id);
    return NextResponse.json({ ok: true, username });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 200) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const action = new URL(req.url).searchParams.get("action");
  if (action === "logout") {
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  }
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const db = getDb();
  const user = (
    await db`SELECT username, auth_type FROM accounts WHERE id = ${accountId} LIMIT 1`
  )[0] as { username: string; auth_type: string } | undefined;
  return NextResponse.json({
    accountId,
    username: user?.username ?? "",
    authType: user?.auth_type ?? "demo",
  });
}
