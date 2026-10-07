import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { claimQueuedPost, releasePost, touchSchedule } from "@/lib/pipeline";
import { getHotList, generateTargetedComment } from "@/lib/hotlist";
import { searchSubredditPosts, submitComment } from "@/lib/reddit";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // open in dev/demo
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getDb();
  const steps: string[] = [];
  let added = 0;

  const scheds = await db`
    SELECT s.id, s.account_id, s.autopost, a.token
    FROM schedules s JOIN accounts a ON a.id = s.account_id
    WHERE s.status = 'active'`;
  if (scheds.length === 0) {
    return NextResponse.json({ steps: ["no active schedules — nothing to do"] });
  }
  const sched = scheds[0] as { id: number; account_id: number; autopost: boolean; token: string | null };

  // 1) DISCOVER new leads for every active target.
  const targets = await db`SELECT id, url FROM targets WHERE account_id = ${sched.account_id}`;
  for (const t of targets as { id: number; url: string }[]) {
    const rts = await db`SELECT subreddit, keyword, min_score FROM reddit_targets WHERE target_id = ${t.id}`;
    for (const rt of rts as { subreddit: string; keyword: string; min_score: number }[]) {
      const raw = await searchSubredditPosts(rt.subreddit, rt.keyword, 25);
      const hot = getHotList(raw, t.url).filter((p) => p.score >= (rt.min_score || 0)).slice(0, 10);
      for (const lead of hot) {
        const exists = await db`SELECT 1 FROM posts WHERE post_id = ${lead.id} LIMIT 1`;
        if (exists.length) continue;
        await db`
          INSERT INTO posts (target_id, post_id, subreddit, title, selftext, url, num_views, num_comments, score, heat, status)
          VALUES (${t.id}, ${lead.id}, ${lead.subreddit}, ${lead.title}, ${lead.selftext}, ${lead.permalink}, ${lead.estViews}, ${lead.numComments}, ${lead.score}, ${lead.heat}, 'queued')`;
        added++;
      }
      steps.push(`discover: r/${rt.subreddit} "${rt.keyword || "any"}" → +${hot.length} hot, ${added} new`);
    }
  }

  // 2) AUTOPOST — claim and comment.
  const post = await claimQueuedPost();
  if (post && sched.autopost && sched.token) {
    try {
      const prow = (
        await db`SELECT post_id, subreddit, title FROM posts WHERE id = ${post.id}`
      )[0] as { post_id: string; subreddit: string; title: string };
      const trow = (
        await db`SELECT url FROM targets WHERE id = (SELECT target_id FROM posts WHERE id = ${post.id})`
      )[0] as { url: string };
      const text = generateTargetedComment(
        { id: prow.post_id, subreddit: prow.subreddit, title: prow.title, selftext: "", url: "", numComments: 0, score: 0, viewRatio: 0, permalink: "", heat: 0, segment: "HOT", estViews: 0, estClicks: 0 },
        trow.url, true, false,
      );
      const cid = await submitComment(sched.token, prow.post_id, text);
      await db`INSERT INTO comments (post_id, is_auto, is_ai, body, comment_id, status)
               VALUES (${post.id}, true, true, ${text}, ${cid}, 'submitted_on_reddit')`;
      await db`UPDATE posts SET status = 'target_done' WHERE id = ${post.id}`;
      await touchSchedule(sched.account_id);
      steps.push(`autopost ✅ commented on r/${post.subreddit} (post #${post.id})`);
    } catch (err) {
      await releasePost(post.id);
      steps.push(`autopost failed for post #${post.id}: ${String(err).slice(0, 140)}`);
    }
  } else if (post && (!sched.autopost || !sched.token)) {
    await releasePost(post.id);
    steps.push(`autopost off or no Reddit token — post #${post.id} released`);
  } else {
    steps.push("queue empty — nothing to comment on");
  }

  return NextResponse.json({ steps, added });
}

export async function GET(req: Request) {
  return POST(req);
}
