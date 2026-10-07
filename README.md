# Engain — Reddit hot-lead autopilot (by Freebuff)

Finds Reddit threads that are **already getting views and clicks**, drafts a
comment that mentions **your website link and description**, and autoposts it
on a schedule. Runs locally and on Vercel.

## What it does

1. **Discovery** — searches the subreddits + keywords you set via Reddit's
   public JSON search, scores every thread with the **HOT lead engine**
   (views + click-intent + comment velocity) and sorts hottest first.
2. **Comment engine** — generates a personal-sounding comment that mentions
   your site naturally (tier templates + seeded variation, OpenAI optional).
3. **Autopost** — Vercel Cron hits `/api/cron` every 10 minutes: discovers new
   leads, claims the hottest queued one, comments with your stored Reddit
   token, and records everything in the dashboard log.
4. **Dashboard** — add your website, watch subreddits, toggle autopilot,
   run the worker manually, draft or post comments per thread.

Reddit credentials stay **optional**: without them the app runs in **demo
mode** (fake leads + simulated comments) so you can see the full flow before
connecting a real account.

## 1 · Setup (2 minutes)

1. Create a free Postgres at [neon.com](https://neon.com) → copy the
   connection string.
2. Paste it into `.env.local` as `DATABASE_URL=...`
3. Push the schema and seed demo data:

```bash
npm install
npx drizzle-kit push --force
npm run dev
```

4. Open `http://localhost:3000` → **Try the demo** → the dashboard walks you
   through adding your website, subreddits, and turning autopilot on.

## 2 · Connect a real Reddit account (when ready)

Create a "script" app at `reddit.com/prefs/apps` (redirect URI:
`http://localhost:3000`), then paste the **access token** (and refresh token)
via the dashboard's autopilot panel — or set them in the DB
`accounts.token` / `accounts.refresh_token_enc`. The cron worker uses the
token to comment and auto-refreshes it.

## 3 · Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel        # link the project
vercel env add DATABASE_URL
vercel --prod
```

`vercel.json` already registers the every-10-minutes cron that drives
autoposting. Same env vars on Vercel: `DATABASE_URL`, `APP_SECRET`,
(optional) `REDDIT_CLIENT_ID/SECRET`, `OPENAI_API_KEY`, `CRON_SECRET`.

## Env reference

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon Postgres connection string |
| `APP_SECRET` | prod | HMAC session signing |
| `REDDIT_CLIENT_ID/SECRET` | optional | live Reddit commenting |
| `OPENAI_API_KEY` | optional | smarter comment wording |
| `CRON_SECRET` | prod | protects `/api/cron` |

Built with Next.js 15, Drizzle, Neon Postgres, snoowrap, Tailwind.
