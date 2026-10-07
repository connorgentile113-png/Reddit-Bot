import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionAccountId } from "@/lib/auth";
import { getHotList, generateTargetedComment } from "@/lib/hotlist";
import { searchSubredditPosts, type RedditPostData } from "@/lib/reddit";

/** Discover leads for a target's subreddits and persist new HOT posts. */
export async function POST(req: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as {
    targetId?: number;
    limitPerSub?: number;
  };

  const targets = body.targetId
    ? await db`SELECT id, url FROM targets WHERE id = ${body.targetId} AND account_id = ${accountId}`
    : await db`SELECT id, url FROM targets WHERE account_id = ${accountId}`;

  let added = 0;
  const perSub = Math.min(50, body.limitPerSub || 20);
  for (const t of targets as { id: number; url: string }[]) {
    const rts = await db`SELECT subreddit, keyword, min_score FROM reddit_targets WHERE target_id = ${t.id}`;
    for (const rt of rts as { subreddit: string; keyword: string; min_score: number }[]) {
      const raw = await searchSubredditPosts(rt.subreddit, rt.keyword, perSub);
      const hot = getHotList(raw, t.url).filter((p) => p.score >= (rt.min_score ?? 0));
      const top = hot.slice(0, 15);
      for (const lead of top) {
        const exists = await db`SELECT 1 FROM posts WHERE post_id = ${lead.id} LIMIT 1`;
        if (exists.length) continue;
        await db`
          INSERT INTO posts (target_id, post_id, subreddit, title, selftext, url, num_views, num_comments, score, heat, status)
          VALUES (${t.id}, ${lead.id}, ${lead.subreddit}, ${lead.title}, ${lead.selftext}, ${lead.permalink}, ${lead.estViews}, ${lead.numComments}, ${lead.score}, ${lead.heat}, ${"queued"})
        `;
        added++;
      }
    }
  }
  return NextResponse.json({ ok: true, added });
}

/** List posts for dashboard feed. */
export async function GET() {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const db = getDb();
  const rows = await db`
    SELECT p.id, p.post_id, p.subreddit, p.title, p.selftext, p.num_views, p.num_comments, p.score, p.heat, p.status,
           p.processed_at, t.url AS target_url
    FROM posts p JOIN targets t ON t.id = p.target_id
    WHERE t.account_id = ${accountId}
    ORDER BY p.heat DESC, p.id ASC
    LIMIT 200
  `;
  return NextResponse.json({ posts: rows });
}

export type { RedditPostData };
