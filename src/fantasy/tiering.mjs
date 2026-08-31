// Positional tiering.
//
// Rankings, not projections (ADR-0002). The unit is an ordinal position
// within a format, and the output that matters is where the *cliffs* are:
// "is there another player like this one still on the board?"
//
// Method — separation, not raw gap. Walk a position's consensus order and
// measure the step between adjacent players in units of how much the
// sources disagree about them:
//
//   separation(i) = (mean[i+1] - mean[i]) / sqrt((sd[i]^2 + sd[i+1]^2)/2 + eps)
//
// Disagreement therefore *narrows* a break. If the sources cannot agree
// which of two players goes first, they are interchangeable and belong in
// one tier; a break survives only where the sources agree there is a real
// step down.
//
// The threshold is per-position, derived from that position's own
// separation distribution (median + k x MAD) — the RB curve is nothing like
// the QB curve, and a global constant would mis-tier both.

const EPS = 0.25; // floor on pooled spread; keeps a zero-variance pair finite

export function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mad(xs) {
  if (!xs.length) return 0;
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/**
 * @param {Array<{id,name,team,position,mean,sd,sources}>} players
 *   One position, already ordered by ascending `mean` consensus rank.
 * @param {{k?: number, minTier?: number, maxTier?: number}} opts
 * @returns {{breaks:number[], separations:number[], threshold:number, method:string}}
 *   `breaks` are indices at which a NEW tier starts.
 */
export function computeBreaks(players, opts = {}) {
  const k = opts.k ?? 1.0;
  const minTier = opts.minTier ?? 2;
  const maxTier = opts.maxTier ?? 8;

  if (players.length < 2) {
    return { breaks: [], separations: [], threshold: 0, method: 'trivial' };
  }

  const singleSource = players.every((p) => (p.sd ?? 0) === 0);
  const method = singleSource ? 'gap/median-gap (single source)' : 'separation (mean gap / pooled sd)';

  const separations = [];
  for (let i = 0; i < players.length - 1; i++) {
    const gap = players[i + 1].mean - players[i].mean;
    if (singleSource) {
      separations.push(gap);
    } else {
      const sdA = players[i].sd ?? 0;
      const sdB = players[i + 1].sd ?? 0;
      const pooled = Math.sqrt((sdA * sdA + sdB * sdB) / 2 + EPS * EPS);
      separations.push(gap / pooled);
    }
  }

  const base = singleSource
    ? median(separations) * 2.0
    : median(separations) + k * mad(separations) * 1.4826;
  const threshold = Math.max(base, 1e-9);

  const breaks = [];
  let sinceBreak = 1;
  for (let i = 0; i < separations.length; i++) {
    sinceBreak++;
    const wantBreak = separations[i] > threshold;
    const forced = sinceBreak > maxTier;
    if ((wantBreak && sinceBreak > minTier) || forced) {
      breaks.push(i + 1);
      sinceBreak = 1;
    }
  }
  return { breaks, separations, threshold, method };
}

/** Turn break indices into tier numbers, 1-based. */
export function applyBreaks(players, breaks) {
  const set = new Set(breaks);
  let tier = 1;
  return players.map((p, i) => {
    if (set.has(i)) tier++;
    return { ...p, tier };
  });
}

/**
 * Where every player carries the same source's own tier, that tiering IS the
 * answer: the author is the expert and their tiers are the product being
 * ranked (ADR-0003). Returns break indices derived from the source tiers, or
 * null when the source publishes none (K and DST, typically).
 */
export function breaksFromSourceTiers(ordered, source) {
  const tiers = ordered.map((p) => p.source_tiers?.[source]);
  if (tiers.some((t) => t == null)) return null;
  const breaks = [];
  for (let i = 1; i < tiers.length; i++) if (tiers[i] !== tiers[i - 1]) breaks.push(i);
  return breaks;
}

/**
 * Tier one position end to end.
 *
 * Precedence: the source's own tiers > the computed breaks > a human
 * override on top of either. An override is recorded ALONGSIDE what it
 * replaced, never instead of it (Principle 6), and the board always says
 * which of the three it is showing — a computed tier must never be mistaken
 * for the author's.
 */
export function tierPosition(players, { accepted = null, note = null, sourceTiersFrom = null, ...opts } = {}) {
  const ordered = [...players].sort((a, b) => a.mean - b.mean);
  const { breaks, separations, threshold, method } = computeBreaks(ordered, opts);

  const sourceBreaks = sourceTiersFrom ? breaksFromSourceTiers(ordered, sourceTiersFrom) : null;
  const used = accepted ?? sourceBreaks ?? breaks;
  const tierSource = accepted ? 'human override' : sourceBreaks ? sourceTiersFrom : 'computed';

  return {
    players: applyBreaks(ordered, used).map((p, i) => ({ ...p, rank_position: i + 1 })),
    tier_source: tierSource,
    source_breaks: sourceBreaks,
    computed_breaks: breaks,
    accepted_breaks: accepted,
    override_note: note,
    threshold: Number(threshold.toFixed(4)),
    separations: separations.map((s) => Number(s.toFixed(3))),
    method: sourceBreaks
      ? `tiers published by ${sourceTiersFrom}`
      : method,
  };
}
