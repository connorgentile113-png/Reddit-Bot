import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionAccountId } from "@/lib/auth";

/** Comment + DM log for the dashboard. */
export async function GET() {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const db = getDb();
  const rows = await db`
    SELECT c.id, c.body, c.status, c.is_auto, c.is_ai, c.created_at,
           p.subreddit, p.title, p.post_id
    FROM comments c JOIN posts p ON p.id = c.post_id
    JOIN targets t ON t.id = p.target_id
    WHERE t.account_id = ${accountId}
    ORDER BY c.created_at DESC
    LIMIT 100
  `;
  return NextResponse.json({ comments: rows });
}

/** Add a manual comment record (Utilities → add comment). */
export async function POST(req: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    postId?: number;
    body?: string;
  };
  if (!body.postId || !body.body) {
    return NextResponse.json({ error: "postId and body required" }, { status: 400 });
  }
  const db = getDb();
  const allowed = await db`
    SELECT 1 FROM posts p JOIN targets t ON t.id = p.target_id
    WHERE p.id = ${body.postId} AND t.account_id = ${accountId} LIMIT 1`;
  if (!allowed.length) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await db`INSERT INTO comments (post_id, is_auto, is_ai, body, status) VALUES (${body.postId}, false, false, ${body.body}, 'submitted')`;
  return NextResponse.json({ ok: true });
}
