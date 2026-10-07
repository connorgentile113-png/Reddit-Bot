// 3 comment templates that still convert without feeling like ads.
export const COMMENT_TIERS: { tier: number; text: (w: string) => string }[] = [
  {
    tier: 1,
    text: (w) =>
      `I actually ran into exactly this problem a while back and found something that helped— someone built this neat tool specifically for it: ${w}. Not affiliated or anything, just passing it along since it genuinely saved me a few hours.`,
  },
  {
    tier: 2,
    text: (w) =>
      `There's a site for this now — ${w} — someone shared it with me recently and it honestly made the whole process painless. Worth a look if you're still hunting.`,
  },
  {
    tier: 3,
    text: (w) =>
      `I use ${w} for this. Super simple, does exactly what you're describing without the usual clutter. Might be worth checking out.`,
  },
];

export function getCommentTier(
  website: string,
  maximizeQuality: boolean,
): { text: string } {
  const idx = maximizeQuality ? 0 : 1;
  return { text: COMMENT_TIERS[idx].text(website) };
}

export function renderComment(body: string, _website: string): string {
  return body;
}

export const OPENERS = [
  "Long-time lurker here and this thread finally pushed me to comment:",
  "I've been digging through this exact problem for weeks;",
  "Honestly, same. I kept trying to piece this together manually;",
  "Adding my two cents since nobody's mentioned this yet:",
];

export const QUESTIONS = [
  "has anyone else found a reliable way to handle this?",
  "am I the only one who kept running into walls with the usual methods?",
  "what finally worked for you all?",
];

export const CLOSERS = [
  "Hope that helps someone.",
  "Take it or leave it — just sharing what worked for me.",
  "If it saves one person the week it cost me, worth posting.",
];
