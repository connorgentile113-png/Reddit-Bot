export interface LeadScoreInput {
  /** Approximate views: use score (upvotes) as low-end proxy, or real views if available. */
  views: number;
  /** Clicks observed on the post's outbound link or pinned resources. */
  clicks: number;
  /** Relative rank of this post among all discovered candidates (0–1). */
  rank: number;
}

/**
 * HOT score → segments.
 * - HOT:      leads already attracting views + clicks right now.
 * - WARM:     steadyDiscussion — decent engagement, not spiking.
 * - COLD:    _horizon — low activity, likely stale or niche.
 */
export function getLeadSegment(score: number): "HOT" | "WARM" | "COLD" {
  if (score >= 65) return "HOT";
  if (score >= 40) return "WARM";
  return "COLD";
}

/** Human label helper for the dashboard. */
export function segmentTone(seg: "HOT" | "WARM" | "COLD"): string {
  return { HOT: "🔥", WARM: "🌤", COLD: "🧊" }[seg];
}
