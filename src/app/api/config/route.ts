import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionAccountId } from "@/lib/auth";
import { getConfig, missingEnv } from "@/lib/config";

export async function GET() {
  return NextResponse.json({ config: getConfig(), missing: missingEnv() });
}

/** Save current setup:website / reddit username / schedule prefs. */
export async function POST(req: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    website?: string;
    redditUsername?: string;
    commentsPerDay?: number;
  };
  const db = getDb();

  if (body.website) {
    const existing = (
      await db`SELECT id FROM targets WHERE account_id = ${accountId} LIMIT 1`
    )[0];
    if (existing) {
      await db`UPDATE targets SET url = ${body.website} WHERE id = ${(existing as { id: number }).id}`;
    } else {
      await db`INSERT INTO targets (account_id, url) VALUES (${accountId}, ${body.website})`;
    }
    return NextResponse.json({ ok: true, website: body.website });
  }
  if (body.redditUsername) {
    await db`UPDATE schedules SET reddit_username = ${body.redditUsername} WHERE account_id = ${accountId}`;
    return NextResponse.json({ ok: true });
  }
  if (body.commentsPerDay) {
    await db`UPDATE schedules SET requested_comments_per_day = ${body.commentsPerDay} WHERE account_id = ${accountId}`;
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "nothing to update" }, { status: 400 });
}
