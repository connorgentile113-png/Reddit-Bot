import { createNeonClient, type SqlClient } from "./db";

/** All table creation, idempotent. Shared by setup API and demo login. */
export async function ensureTables(
  sql: SqlClient,
): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    auth_type TEXT NOT NULL DEFAULT 'demo',
    token TEXT,
    refresh_token_enc TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_key ON accounts (LOWER(username))`;
  await sql`CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    url TEXT NOT NULL,
    keywords TEXT NOT NULL DEFAULT '',
    minimize_description BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS reddit_targets (
    id SERIAL PRIMARY KEY,
    target_id INTEGER NOT NULL REFERENCES targets(id),
    subreddit TEXT NOT NULL,
    keyword TEXT NOT NULL DEFAULT '',
    min_score INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    target_id INTEGER NOT NULL REFERENCES targets(id),
    post_id TEXT NOT NULL,
    subreddit TEXT NOT NULL,
    title TEXT,
    selftext TEXT,
    url TEXT,
    num_views INTEGER NOT NULL DEFAULT 0,
    num_comments INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    heat INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'found',
    processed_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    author TEXT NOT NULL DEFAULT 'you',
    is_auto BOOLEAN NOT NULL DEFAULT false,
    is_ai BOOLEAN NOT NULL DEFAULT false,
    body TEXT NOT NULL,
    comment_id TEXT,
    status TEXT NOT NULL DEFAULT 'submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS comment_replies (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES comments(id),
    parent_id TEXT,
    body TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    author TEXT,
    depth INTEGER NOT NULL DEFAULT 0,
    watch_from TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    status TEXT NOT NULL DEFAULT 'active',
    autopost BOOLEAN NOT NULL DEFAULT false,
    requested_comments_per_day INTEGER NOT NULL DEFAULT 5,
    scheduled_times INTEGER NOT NULL DEFAULT -1,
    reddit_username TEXT,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS generated_items (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    body TEXT NOT NULL,
    receiver TEXT,
    subject TEXT,
    post_id INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}

/** Seed a couple of demo leads so a fresh account shows a working pipeline. */
export async function seedDemo(accountId: number, sql: SqlClient): Promise<void> {
  const cnt = (await sql`SELECT count(*)::int AS c FROM posts`)[0] as { c: number };
  if (cnt.c > 0) return;
  const t = (await sql`INSERT INTO targets (account_id, url, keywords)
    VALUES (${accountId}, ${"https://example.com"}, ${"automation, marketing"}) RETURNING id`)[0] as { id: number };
  await sql`INSERT INTO reddit_targets (target_id, subreddit, keyword) VALUES (${t.id}, ${"marketing"}, ${"automation"})`;
  await sql`INSERT INTO reddit_targets (target_id, subreddit, keyword) VALUES (${t.id}, ${"Entrepreneur"}, ${"tool"})`;
  await sql`INSERT INTO posts (target_id, post_id, subreddit, title, selftext, num_views, num_comments, score, heat, status)
    VALUES (${t.id}, ${"demo_seed_1"}, ${"marketing"}, ${"Looking for a tool that.comments on Reddit for me"}, ${"Anyone know something that actually works? Tired of doing it manually."}, ${4200}, ${37}, ${210}, ${82}, ${"queued"})`;
  await sql`INSERT INTO posts (target_id, post_id, subreddit, title, selftext, num_views, num_comments, score, heat, status)
    VALUES (${t.id}, ${"demo_seed_2"}, ${"Entrepreneur"}, ${"First 100 users — what actually worked for you?"}, ${"Cold DMs? Ads? Something smarter?"}, ${2600}, ${22}, ${140}, ${64}, ${"found"})`;
}
