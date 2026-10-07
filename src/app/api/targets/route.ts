import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionAccountId } from "@/lib/auth";

export async function GET() {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const db = getDb();
  const rows = await db`
    SELECT t.id AS target_id, t.url, t.keywords,
           r.id AS rt_id, r.subreddit, r.keyword, r.min_score
    FROM targets t LEFT JOIN reddit_targets r ON r.target_id = t.id
    WHERE t.account_id = ${accountId}
    ORDER BY t.id, r.id
  `;
  const map = new Map<number, { id: number; url: string; keywords: string; subs: { id: number; subreddit: string; keyword: string; minScore: number }[] }>();
  for (const r of rows as Record<string, unknown>[]) {
    const tid = r.target_id as number;
    if (!map.has(tid)) map.set(tid, { id: tid, url: r.url as string, keywords: (r.keywords as string) || "", subs: [] });
    if (r.rt_id) {
      map.get(tid)!.subs.push({
        id: r.rt_id as number,
        subreddit: r.subreddit as string,
        keyword: (r.keyword as string) || "",
        minScore: (r.min_score as number) ?? 3,
      });
    }
  }
  return NextResponse.json({ targets: [...map.values()] });
}

/** Add a subreddit watcher to the (first) target. */
export async function POST(req: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    subreddit?: string;
    keyword?: string;
    minScore?: number;
  };
  if (!body.subreddit) return NextResponse.json({ error: "subreddit required" }, { status: 400 });
  const db = getDb();
  const t = (await db`SELECT id FROM targets WHERE account_id = ${accountId} ORDER BY id LIMIT 1`)[0] as { id: number } | undefined;
  if (!t) return NextResponse.json({ error: "save your website first" }, { status: 400 });
  await db`INSERT INTO reddit_targets (target_id, subreddit, keyword, min_score)
           VALUES (${t.id}, ${body.subreddit}, ${body.keyword || ""}, ${body.minScore ?? 3})`;
  return NextResponse.json({ ok: true });
}

/** Delete a subreddit watcher. */
export async function DELETE(req: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = getDb();
  await db`DELETE FROM reddit_targets WHERE id = ${id} AND target_id IN (SELECT id FROM targets WHERE account_id = ${accountId})`;
  return NextResponse.json({ ok: true });
}
