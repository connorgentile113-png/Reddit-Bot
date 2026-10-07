import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionAccountId } from "@/lib/auth";

/** Autopilot toggle from the dashboard. */
export async function POST(req: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    autopost?: boolean;
    commentsPerDay?: number;
    token?: string;
    refreshToken?: string;
  };
  const db = getDb();

  if (body.token) {
    // Connect Reddit OAuth manually (paste token from reddit.com/prefs/apps flow).
    await db`UPDATE accounts SET token = ${body.token}, auth_type = 'oauth', token_expires_at = now() + interval '55 minutes' WHERE id = ${accountId}`;
    if (body.refreshToken) {
      await db`UPDATE accounts SET refresh_token_enc = ${body.refreshToken} WHERE id = ${accountId}`;
    }
    return NextResponse.json({ ok: true, connected: "reddit" });
  }

  if (typeof body.autopost === "boolean") {
    await db`UPDATE schedules SET autopost = ${body.autopost} WHERE account_id = ${accountId}`;
    return NextResponse.json({ ok: true, autopost: body.autopost });
  }
  if (body.commentsPerDay) {
    await db`UPDATE schedules SET requested_comments_per_day = ${body.commentsPerDay} WHERE account_id = ${accountId}`;
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "nothing to update" }, { status: 400 });
}

/** Ping autopilot state + refresh token if 近 expiry. */
export async function GET() {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const db = getDb();
  const sched = (
    await db`SELECT status, autopost, requested_comments_per_day, last_run_at FROM schedules WHERE account_id = ${accountId} LIMIT 1`
  )[0];
  const acct = (
    await db`SELECT auth_type, token, refresh_token_enc, token_expires_at, username FROM accounts WHERE id = ${accountId} LIMIT 1`
  )[0];
  return NextResponse.json({ schedule: sched, account: acct });
}
