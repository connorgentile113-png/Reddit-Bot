import { getDb } from "./db";

/** Claim the oldest queued post atomically (skip-locked, serverless safe). */
export async function claimQueuedPost(): Promise<{ id: number; subreddit: string } | null> {
  const db = getDb();
  const rows = await db`
    UPDATE posts SET status = 'target_processing', processed_at = now()
    WHERE id = (
      SELECT p.id FROM posts p
      JOIN targets t ON t.id = p.target_id
      JOIN schedules s ON s.account_id = t.account_id AND s.status = 'active' AND s.autopost = true
      WHERE p.status = 'queued'
      ORDER BY p.heat DESC, p.id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, subreddit
  `;
  return (rows[0] as { id: number; subreddit: string } | undefined) ?? null;
}

export async function releasePost(postId: number): Promise<void> {
  const db = getDb();
  await db`UPDATE posts SET status = 'queued' WHERE id = ${postId}`;
}

export async function touchSchedule(accountId: number): Promise<void> {
  const db = getDb();
  await db`UPDATE schedules SET last_run_at = now() WHERE account_id = ${accountId}`;
}
