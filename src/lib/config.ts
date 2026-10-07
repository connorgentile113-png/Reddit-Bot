export interface AppConfig {
  database: boolean;
  redditOAuth: boolean;
  ai: boolean;
  cron: boolean;
}

export function getConfig(): AppConfig {
  return {
    database: !!process.env.DATABASE_URL,
    redditOAuth:
      !!process.env.REDDIT_CLIENT_ID && !!process.env.REDDIT_CLIENT_SECRET,
    ai: !!process.env.OPENAI_API_KEY,
    cron: !!process.env.CRON_SECRET,
  };
}

export function missingEnv(): string[] {
  const c = getConfig();
  const out: string[] = [];
  if (!c.database) out.push("DATABASE_URL");
  if (!c.redditOAuth) out.push("REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET");
  if (!c.ai) out.push("OPENAI_API_KEY");
  if (!c.cron) out.push("CRON_SECRET");
  return out;
}
