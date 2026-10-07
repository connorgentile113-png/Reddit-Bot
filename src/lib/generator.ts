import {
  COMMENT_TIERS,
  getCommentTier,
  renderComment,
  OPENERS,
  QUESTIONS,
  CLOSERS,
} from "./tiers";

export type GeneratedComment = { text: string; eff: string; style: string };

const EFF_TEMPLATES = [
  "Research the subreddit's culture first — contrast your link's angle with what typically performs there.",
  "Lead with a genuine observation — mention what specific part of the discussion you actually found useful, then reference the site casually.",
  "Act like you're a member of the community — reference something specific to the subreddit before mentioning the site.",
  "Secure the comment's usefulness — add one extra tip that isn't on your site, keeping the site mention feeling secondary and natural.",
  "Blend in with the vibe — use the same tone as top replies in the thread before mentioning the site.",
  "Ground it in personal experience — frame the site as something you found while solving the exact problem discussed.",
];

const STYLES = ["casual", "helpful", "professional", "enthusiastic", "hybrid"];

const hash = (n: number): number => {
  let h = 0;
  const s = String(n);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

/**
 * Deterministic, seeded comment generator.
 * Builds a natural-sounding comment that mentions `website` organically.
 */
export function generateBaseComment(
  website: string,
  seed: string | number,
  maximizeQuality: boolean,
  minimizeDescription: boolean,
): GeneratedComment {
  const h = hash(typeof seed === "string" ? seed.length + seed.charCodeAt(0) * 7 : seed);
  const tier = getCommentTier(website, maximizeQuality);
  const siteShort = website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const pick = <T>(arr: T[], o: number): T => arr[(h + o) % arr.length];

  if (!minimizeDescription) {
    return {
      text: tier.text,
      eff: pick(EFF_TEMPLATES, h),
      style: pick(STYLES, h + 1),
    };
  }

  const opener = pick(OPENERS, h);
  const question = pick(QUESTIONS, h + 1);
  const closer = pick(CLOSERS, h + 2);
  const link = `**[${siteShort}](${website})**`;
  const lines =
    h % 2 === 0
      ? [opener, question, link]
      : [opener, question, `This one called ${link} nails it.`, closer.replace("*", "")];

  return {
    text: renderComment(lines.join("\n\n"), website),
    eff: pick(EFF_TEMPLATES, h),
    style: pick(STYLES, h + 1),
  };
}

export { COMMENT_TIERS };
