// guillotine.mjs — re-rank a season-long board for a Guillotine league.
//
// A guillotine league is not a scoring contest, it is a survival contest: the
// lowest-scoring team each week is eliminated and its whole roster hits FAAB
// waivers. There are no playoffs and no championship week, so nothing you
// draft matters unless it scores while you are still alive.
//
// This module does NOT produce new rankings. It takes the ranker's ordering as
// given (ADR-0003) and applies a small number of explicit, documented shifts
// for the things the format changes. Every shift is expressed in **rank slots**
// so it is legible, and every player carries the delta from the source rank, so
// the board can always show its own work.
//
// What this module deliberately does NOT do:
//   - invent a floor, ceiling, consistency, or injury-risk score. Those would
//     be numbers with no source (ADR-0002). Injury and snap-count risk is a
//     real guillotine factor and is handled by HUMAN flags, recorded.
//   - use SOS. The export carries a 2-10 SOS value whose polarity is not
//     documented anywhere we can verify, and a sign error would silently
//     invert the adjustment. It is displayed, never computed with.

/**
 * League profile. Everything here is a POLICY choice, not a measurement —
 * stated so it can be argued with and changed in one place.
 */
export const DEFAULT_LEAGUE = {
  teams: 18,
  roster: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, BENCH: 6 },
  // Byes present in the source data are discovered, not assumed.
};

/**
 * Bye-week weight per position, in rank slots, applied at the EARLIEST bye and
 * decaying to zero at the latest.
 *
 * Why earlier byes cost more, and why it is worse the bigger the league:
 * with 18 teams x 14 roster spots, ~252 players are rostered on draft day, so
 * the Week-5 waiver pool is close to empty. Each elimination frees a whole
 * roster, so by Week 13 roughly a dozen teams are gone and ~168 players have
 * come back to the pool. A late bye is covered from a rich pool; an early bye
 * is covered from nothing, in the weeks when you can least afford a zero.
 *
 * The weights are ordered by how hard that position is to cover from waivers
 * in a league this deep, not by how valuable the position is.
 */
export const DEFAULT_BYE_WEIGHTS = {
  TE: 8,  // ~18 rostered of maybe 32 startable; the waiver TE is a punt
  RB: 8,  // two starters plus flex, and the thinnest position by usable bodies
  WR: 5,  // deepest position — a replacement week is survivable
  QB: 5,  // one starter, but 18 teams still leaves real arms unrostered
  K: 3,
  DST: 3,
};

/**
 * @param {number} bye
 * @param {{first:number,last:number}} range  byes actually present in the data
 * @returns {number} 1.0 at the earliest bye, 0.0 at the latest
 */
export function coverDifficulty(bye, range) {
  if (bye == null) return 0;
  const span = range.last - range.first;
  if (span <= 0) return 0;
  const d = (range.last - bye) / span;
  return Math.min(1, Math.max(0, d));
}

export function byeRange(players) {
  const byes = players.map((p) => p.bye).filter((b) => b != null);
  if (!byes.length) return { first: 0, last: 0 };
  return { first: Math.min(...byes), last: Math.max(...byes) };
}

/**
 * Adjust one position's board.
 *
 * @param {Array} players   ordered by the source's rank (ascending)
 * @param {string} position
 * @param {object} opts
 *   byeWeights  {pos: slots}
 *   flags       {playerId: {penalty:number, note:string}} human risk flags
 *   range       bye range for the whole board, so positions stay comparable
 * @returns {Array} same players, re-ordered, each carrying the adjustment trail
 */
export function adjustPosition(players, position, { byeWeights = DEFAULT_BYE_WEIGHTS, flags = {}, range } = {}) {
  const w = byeWeights[position] ?? 5;
  const r = range ?? byeRange(players);

  const scored = players.map((p, i) => {
    const sourceRank = p.rank_position ?? i + 1;
    const difficulty = coverDifficulty(p.bye, r);
    const byeShift = w * difficulty;
    const flag = flags[p.id] || null;
    const flagShift = flag?.penalty ?? 0;
    return {
      ...p,
      source_rank: sourceRank,
      source_tier: p.tier ?? p.source_tier ?? null,
      bye_shift: Number(byeShift.toFixed(2)),
      flag_shift: flagShift,
      flag_note: flag?.note ?? null,
      guillotine_score: sourceRank + byeShift + flagShift,
    };
  });

  scored.sort((a, b) => a.guillotine_score - b.guillotine_score || a.source_rank - b.source_rank);
  scored.forEach((p, i) => {
    p.rank_position = i + 1;
    p.moved = p.source_rank - (i + 1); // + = moved up the board
  });
  return scored;
}

/**
 * Tier the adjusted order by preserving the SOURCE's tier SIZES.
 *
 * The ranker's tiers encode a judgement worth keeping — "these five are the
 * same player to me" — and ADR-0003 says that judgement outranks ours. But the
 * guillotine board is explicitly a different product from his board, so the
 * membership has to follow the adjusted order.
 *
 * Keeping his tier SIZES and letting membership follow the adjustment keeps
 * the part that is his judgement (how many players are equivalent here) and
 * changes only the part the format actually changes (which players those are).
 * Where the source publishes no tiers, `fallbackBreaks` is used instead.
 */
export function tierBySourceSizes(adjusted, sourceTiers, fallbackBreaks = null) {
  const sizes = [];
  if (sourceTiers?.length) {
    let cur = sourceTiers[0], n = 0;
    for (const t of sourceTiers) {
      if (t !== cur) { sizes.push(n); cur = t; n = 0; }
      n++;
    }
    sizes.push(n);
  } else if (fallbackBreaks?.length) {
    let prev = 0;
    for (const b of fallbackBreaks) { sizes.push(b - prev); prev = b; }
    sizes.push(adjusted.length - prev);
  }

  if (!sizes.length) return { players: adjusted.map((p) => ({ ...p, tier: 1 })), sizes: [adjusted.length] };

  const out = [];
  let i = 0, tier = 1;
  for (const size of sizes) {
    for (let k = 0; k < size && i < adjusted.length; k++, i++) out.push({ ...adjusted[i], tier });
    tier++;
  }
  while (i < adjusted.length) out.push({ ...adjusted[i++], tier: tier - 1 });
  return { players: out, sizes };
}

/** Bye distribution for a set of players — the thing that actually kills you. */
export function byeHistogram(players) {
  const h = {};
  for (const p of players) if (p.bye != null) h[p.bye] = (h[p.bye] || 0) + 1;
  return h;
}
