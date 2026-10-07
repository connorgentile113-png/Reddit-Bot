import Snoowrap from "snoowrap";

const UA = "web:engain-freebuff:v1.0.0 (marketing autopilot)";

export interface RedditPostData {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  numComments: number;
  score: number;
  viewRatio: number;
  permalink: string;
}

/** Score ratio: passive viewers vs active commenters (click-intent proxy). */
function ratio(score: number, comments: number): number {
  if (!comments) return 0.4;
  return Math.min(1, score / (comments * 3));
}

/** Discover leads via Reddit's public search JSON (no auth needed for reads). */
export async function searchSubredditPosts(
  subreddit: string,
  keyword: string,
  limit = 25,
): Promise<RedditPostData[]> {
  if (subreddit.startsWith("demo:") || !subreddit) return demoPosts(subreddit, keyword);
  try {
    const q = encodeURIComponent(keyword || "");
    const s = encodeURIComponent(subreddit.replace(/^r\//, "").replace(/^\/?r\//, ""));
    const url =
      `https://www.reddit.com/r/${s}/search.json?q=${q}&restrict_sr=1&sort=new&t=week&limit=${limit}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 300 },
    });
    if (!res.ok) return demoPosts(subreddit, keyword);
    const json = (await res.json()) as {
      data: { children: { data: Record<string, unknown> }[] };
    };
    return json.data.children.map((c): RedditPostData => {
      const d = c.data as {
        id: string; subreddit: string; title: string; selftext: string;
        url: string; num_comments: number; score: number; permalink: string;
      };
      return {
        id: d.id,
        subreddit: d.subreddit,
        title: d.title,
        selftext: d.selftext || "",
        url: d.url || "",
        numComments: d.num_comments || 0,
        score: d.score || 0,
        viewRatio: ratio(d.score || 0, d.num_comments || 0),
        permalink: d.permalink || "",
      };
    });
  } catch {
    return demoPosts(subreddit, keyword);
  }
}

function demoPosts(subreddit: string, keyword: string): RedditPostData[] {
  const clean = subreddit.replace(/^r\//, "").replace(/^demo:/, "") || "marketing";
  const angles = [
    "quick question", "recommendation?", "how do you all handle this?",
    "tool request", "weekly help thread", "struggling with workflow",
  ];
  return Array.from({ length: 16 }, (_, i) => {
    const score = 20 + ((i * 137) % 1200);
    const nc = 2 + ((i * 53) % 80);
    return {
      id: `demo_${clean}_${i}`,
      subreddit: clean,
      title: `${keyword || "automation"} — ${angles[i % angles.length]}`,
      selftext:
        i % 2 === 0
          ? `Anyone know a good tool for ${keyword || "this"}? I'm tired of doing it manually every week.`
          : `Looking for recommendations about ${keyword || "this"}, budget-friendly options appreciated.`,
      url: "",
      numComments: nc,
      score,
      viewRatio: ratio(score, nc),
      permalink: `/r/${clean}/comments/demo${i}/`,
    };
  });
}

/** Build authenticated client from account token for commenting/DMs. */
export function makeClient(token: string, refreshToken?: string): Snoowrap {
  return new Snoowrap({
    userAgent: UA,
    accessToken: token,
    refreshToken: refreshToken || undefined,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
  });
}

/** Verify a token works — returns the Reddit username (live mode proof). */
export async function getRedditUsername(accessToken: string): Promise<string> {
  const c = makeClient(accessToken);
  const me = (await (c.getMe() as unknown as Promise<{ name: string }>));
  return me.name;
}

/** Submit a comment. Throws if no creds — callers catch and fall back to demo row. */
export async function submitComment(
  accessToken: string,
  postFullnameId: string,
  text: string,
): Promise<string> {
  const c = makeClient(accessToken);
  type SN = { submitComment: (o: { linkId: string; text: string }) => Promise<{ id?: string; name?: string }> };
  const cm = await (c as unknown as SN).submitComment({ linkId: postFullnameId, text });
  return cm.id || cm.name || "";
}

/** Send a private message (DM). */
export async function sendMessage(
  accessToken: string,
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const c = makeClient(accessToken);
  await c.composeMessage({ to, subject, text });
  return true;
}
