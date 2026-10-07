import { generateBaseComment } from "./generator";
import type { RedditPostData } from "./reddit";
import { getLeadSegment } from "./segments";

export interface HotLead extends RedditPostData {
  heat: number; // 0–100 HOT score
  segment: "HOT" | "WARM" | "COLD";
  estViews: number;
  estClicks: number;
}

/**
 * HOT lead engine — finds flows already getting several views and clicks.
 * score/upvotes act as a floor for views; comment-depth gives leverage for clicks.
 */
export function scoreLead(p: RedditPostData): number {
  const estViews = Math.max(p.score, 1) * (12 + Math.round(p.viewRatio * 40)); // views ≫ upvotes
  const estClicks = Math.round(estViews * p.viewRatio * 0.06);
  const views = Math.log10(Math.max(estViews, 10)) * 22;
  const clicks = Math.min(35, estClicks * 3);
  const velocity = Math.min(20, p.numComments * 1.1);
  return Math.round(Math.min(100, views + clicks + velocity));
}

const denominators = (p: RedditPostData) => {
  const t = (p.title + " " + p.selftext).toLowerCase();
  return (
    t.includes("hiring") ||
    t.includes("[for hire]") ||
    t.includes("giveaway") ||
    t.includes("download my")
  );
};

/** Sort leads HOT → COLD; skip poisoned fits. */
export function getHotList(posts: RedditPostData[], website: string): HotLead[] {
  return posts
    .filter((p) => !denominators(p))
    .map((p) => {
      const heat = scoreLead(p);
      return {
        ...p,
        heat,
        segment: getLeadSegment(heat),
        estViews: Math.max(p.score, 1) * (12 + Math.round(p.viewRatio * 40)),
        estClicks: Math.round(Math.max(p.score, 1) * (12 + Math.round(p.viewRatio * 40)) * p.viewRatio * 0.06),
        hasWebsiteAge: website.startsWith("http"),
      };
    })
    .sort((a, b) => b.heat - a.heat);
}

/** Generate a personalized comment referencing the actual post. */
export function generateTargetedComment(
  lead: HotLead,
  website: string,
  maximizeQuality: boolean,
  minimizeDescription: boolean,
): string {
  const base = generateBaseComment(website, lead.id, maximizeQuality, minimizeDescription);
  const hook = lead.selftext
    ? `"${lead.selftext.slice(0, 70).trim()}…"`
    : `"${lead.title.slice(0, 70).trim()}…"`;
  const personalize = `Saw this in r/${lead.subreddit} — ${hook}\n\n`;
  return personalize + base.text;
}

export type { RedditPostData };
