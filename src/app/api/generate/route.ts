import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionAccountId } from "@/lib/auth";
import { generateTargetedComment, getHotList } from "@/lib/hotlist";
import type { RedditPostData } from "@/lib/reddit";

/** Generate a comment for a post and store it (draft → auto/manual submit). */
export async function POST(req: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "not logged in" }, { status: 401 });
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as {
    postId?: number;
    submit?: boolean;
    maximizeQuality?: boolean;
  };

  // Load the post + target
  const prow = (
    await db`
      SELECT p.id, p.post_id, p.subreddit, p.title, p.selftext, p.target_id, t.url, t.minimize_description
      FROM posts p JOIN targets t ON t.id = p.target_id
      WHERE p.id = ${body.postId} AND t.account_id = ${accountId} LIMIT 1`
  )[0] as
    | { id: number; post_id: string; subreddit: string; title: string; selftext: string; target_id: number; url: string; minimize_description: boolean }
    | undefined;
  if (!prow) return NextResponse.json({ error: "post not found" }, { status: 404 });

  const lead = getHotList(
    [
      {
        id: prow.post_id,
        subreddit: prow.subreddit,
        title: prow.title || "",
        selftext: prow.selftext || "",
        url: "",
        numComments: 0,
        score: 0,
        viewRatio: 0,
        permalink: "",
      } satisfies RedditPostData,
    ],
    prow.url,
  )[0];

  const text = generateTargetedComment(
    lead,
    prow.url,
    body.maximizeQuality ?? false,
    prow.minimize_description,
  );

  if (body.submit) {
    const cred = (
      await db`SELECT token FROM accounts WHERE id = ${accountId} LIMIT 1`
    )[0] as { token: string | null } | undefined;
    const { submitComment } = await import("@/lib/reddit");
    try {
      if (cred?.token) {
        const cid = await submitComment(cred.token, prow.post_id, text);
        await db`INSERT INTO comments (post_id, is_auto, is_ai, body, comment_id, status)
                 VALUES (${prow.id}, false, true, ${text}, ${cid}, 'submitted_on_reddit')`;
        await db`UPDATE posts SET status = 'target_done' WHERE id = ${prow.id}`;
        return NextResponse.json({ ok: true, posted: "reddit", commentId: cid });
      }
      // demo fallback — record only
      await db`INSERT INTO comments (post_id, is_auto, is_ai, body, status)
               VALUES (${prow.id}, false, true, ${text}, 'demo')`;
      await db`UPDATE posts SET status = 'target_done' WHERE id = ${prow.id}`;
      return NextResponse.json({ ok: true, posted: "demo" });
    } catch (err) {
      return NextResponse.json(
        { error: `Reddit API error: ${String(err).slice(0, 200)}`, text },
        { status: 502 },
      );
    }
  }

  // just a preview / draft
  await db`INSERT INTO generated_items (type, body, post_id, status) VALUES ('comment', ${text}, ${prow.id}, 'draft')`;
  return NextResponse.json({ ok: true, text });
}
