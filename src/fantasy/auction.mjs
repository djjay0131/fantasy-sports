// auction.mjs — budget arithmetic for an auction draft.
//
// Two different things get called a "max bid", and conflating them is how
// people lose auctions. This module keeps them apart and labels which is which.
//
// 1. THE HARD MAX is arithmetic and is not a matter of opinion:
//
//        hard max = budget remaining - (open roster spots - 1) x min bid
//
//    Bid a dollar over it and you cannot fill your roster. It is a ceiling,
//    never a recommendation, and it applies to every player equally.
//
// 2. THE SUGGESTED MAX is a POLICY: how much of the budget this project thinks
//    a tier is worth, given how many players at that position will actually
//    start across the league. It is the same kind of judgement call as the
//    guillotine bye weights (ADR-0004) — stated so it can be argued with, not
//    dressed up as a measurement.
//
// What this module does NOT do is derive dollar values from projected points.
// That is the standard approach and it is closed to this project: there are no
// projections here, by decision (ADR-0002), and manufacturing them to get a
// dollar figure would be the exact false precision that ADR exists to prevent.
// Tiers are what the ranker actually gives us, so tiers are what the budget is
// spread across.

export const DEFAULT_ROSTER = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2, K: 0, DST: 0, BENCH: 6 };

/**
 * Share of the total league budget that flows to each position, before tiering.
 *
 * These are policy. They lean on the same fact the guillotine weights do —
 * how replaceable a position is — plus how many roster spots it fills. FLEX is
 * folded into RB and WR because that is where flex dollars actually go.
 */
export const DEFAULT_POSITION_SHARE = {
  RB: 0.40, WR: 0.36, QB: 0.09, TE: 0.11, K: 0.02, DST: 0.02,
};

/**
 * Share of league money that reaches STARTERS at all.
 *
 * This is not taste — it is a constraint. Every team also fills a bench, and
 * those players cost at least the minimum bid apiece. That money is spoken for
 * before a single starter is priced, so pricing starters against the full
 * league pool overstates every one of them. Reserving it is the difference
 * between a model that says a stud RB is worth $90 and one that says $75.
 */
export const STARTER_SHARE = 0.86;

/** Starters the whole league must field at a position — the real demand curve. */
export function leagueDemand(roster, teams) {
  const flexShare = { RB: 0.45, WR: 0.45, TE: 0.10 };
  const demand = {};
  for (const [pos, n] of Object.entries(roster)) {
    if (pos === 'FLEX' || pos === 'BENCH') continue;
    demand[pos] = n * teams;
  }
  for (const [pos, share] of Object.entries(flexShare)) {
    demand[pos] = (demand[pos] || 0) + Math.round((roster.FLEX || 0) * teams * share);
  }
  return demand;
}

/**
 * The ceiling. Pure arithmetic — no policy in here at all.
 * @returns {number} the most you can bid and still fill every remaining spot
 */
export function hardMax({ budgetRemaining, spotsRemaining, minBid = 1 }) {
  if (spotsRemaining <= 0) return 0;
  return Math.max(0, budgetRemaining - (spotsRemaining - 1) * minBid);
}

/**
 * Spread a position's budget across its tiers.
 *
 * The curve is geometric: each tier is worth `decay` of the one above it. That
 * shape is chosen because it matches the thing tiers are FOR — the gap between
 * tier 1 and tier 2 is meant to be a real drop, and a linear spread would deny
 * that. Players below the league's demand line get the minimum bid, because
 * somebody will go undrafted at that position and it does not have to be you.
 */
/**
 * How much each tier is worth relative to the one above it.
 *
 * Policy, and the softest number here. Steep enough that a tier break means
 * something — that is what tiers are for — but not so steep that tier 2 looks
 * like replacement level. Real auction prices at the top are flatter than a
 * naive scarcity curve predicts, because everyone can see the same top tier.
 */
export const DEFAULT_TIER_DECAY = 0.72;

export function tierBudget({ players, positionBudget, demand, decay = DEFAULT_TIER_DECAY, minBid = 1 }) {
  const startable = players.slice(0, Math.max(1, demand));
  const tiers = [...new Set(startable.map((p) => p.tier))].sort((a, b) => a - b);
  if (!tiers.length) return new Map();

  const weights = tiers.map((_, i) => Math.pow(decay, i));
  const counts = tiers.map((t) => startable.filter((p) => p.tier === t).length);
  const totalWeight = weights.reduce((a, w, i) => a + w * counts[i], 0);

  const spendable = Math.max(0, positionBudget - startable.length * minBid);
  const perTier = new Map();
  tiers.forEach((t, i) => {
    perTier.set(t, minBid + (spendable * weights[i]) / (totalWeight || 1));
  });
  return perTier;
}

/**
 * Annotate one position's players with both numbers.
 * `hard` is the same for everyone; `suggested` is the policy figure.
 */
export function priceposition(players, { positionBudget, demand, budgetRemaining, spotsRemaining, minBid = 1, decay }) {
  const perTier = tierBudget({ players, positionBudget, demand, decay, minBid });
  const cap = hardMax({ budgetRemaining, spotsRemaining, minBid });
  return players.map((p, i) => {
    const raw = perTier.get(p.tier);
    const suggested = raw == null || i >= demand ? minBid : Math.max(minBid, Math.round(raw));
    return {
      ...p,
      max_bid_hard: cap,
      max_bid_suggested: Math.min(suggested, cap),
      above_demand_line: i >= demand,
    };
  });
}

/**
 * Whole-board pricing.
 * @param {object} board          a guillotine or PPR board
 * @param {object} league         {teams, budget, roster, minBid}
 * @param {object} you            {budgetRemaining, spotsRemaining}
 * @param {Set<string>} taken     canonical ids already off the board
 */
export function priceBoard(board, league, you, taken = new Set()) {
  const { teams, budget, roster = DEFAULT_ROSTER, minBid = 1 } = league;
  const demand = leagueDemand(roster, teams);
  const leagueMoney = teams * budget;
  const out = {};

  for (const [pos, block] of Object.entries(board.positions)) {
    const available = block.players.filter((p) => !taken.has(p.id));
    const share = DEFAULT_POSITION_SHARE[pos] ?? 0.02;
    const positionBudget = leagueMoney * STARTER_SHARE * share;
    out[pos] = {
      ...block,
      demand: demand[pos] ?? 0,
      position_budget: Math.round(positionBudget),
      players: priceposition(available, {
        positionBudget,
        demand: demand[pos] ?? available.length,
        budgetRemaining: you.budgetRemaining,
        spotsRemaining: you.spotsRemaining,
        minBid,
      }),
      taken_count: block.players.length - available.length,
    };
  }
  return { demand, leagueMoney, positions: out };
}
