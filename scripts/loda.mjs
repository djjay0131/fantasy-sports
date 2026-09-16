#!/usr/bin/env node
// loda.mjs — the L-O-D-A auction board: Jeff's PPR board, priced against the
// money actually left in the room, with rostered players marked gone.
//
//   node scripts/loda.mjs
//
// League facts come from data/processed/loda-league.json (git-ignored), which
// mirrors the league's own MONEY STATUS sheet. Everything here is derived from
// that plus the ranker's board; nothing is projected.

import fs from 'node:fs';
import path from 'node:path';
import { priceBoard, hardMax } from '../src/fantasy/auction.mjs';

const args = process.argv.slice(2);
const arg = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const boardPath = arg('--board', 'docs/data/rankings.json');
const leaguePath = arg('--league', 'data/processed/loda-league.json');
const takenPath = arg('--taken', 'data/processed/taken.json');
const outPath = arg('--out', 'docs/data/loda.json');

const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const cfg = JSON.parse(fs.readFileSync(leaguePath, 'utf8'));
const takenRows = fs.existsSync(takenPath) ? JSON.parse(fs.readFileSync(takenPath, 'utf8')) : [];
const taken = new Set(takenRows.map((t) => t.id));

const teams = cfg.teams;
const moneyRemaining = teams.reduce((a, t) => a + t.left, 0);
const spotsRemaining = teams.reduce((a, t) => a + t.needed, 0);
const me = teams.find((t) => t.me);
if (!me) throw new Error('mark your own team with "me": true in ' + leaguePath);

// IDP money leaves the room and never touches the offense pool. The share of
// open spots that are IDP is estimated from the league's roster shape; the
// per-spot cost is what late IDP actually goes for in a $200 league.
const idpSpots = Math.round(spotsRemaining * (cfg.idp_spot_share ?? 0.4));
const unrankedReserve = idpSpots * (cfg.idp_avg_cost ?? 2.5);

const league = {
  teams: teams.length,
  budget: cfg.budget,
  roster: cfg.roster,
  minBid: cfg.min_bid ?? 1,
  moneyRemaining,
  spotsRemaining,
  unrankedReserve,
};
const you = { budgetRemaining: me.left, spotsRemaining: me.needed };

const priced = priceBoard(board, league, you, taken);

// Players you hold buy-back rights on are IN the pool — the room bids, you
// match — so they are priced like anyone else, and flagged so the board can
// say "this one you can guarantee".
const rightsPath = arg('--rights', 'data/processed/loda-rights.json');
const rights = fs.existsSync(rightsPath) ? JSON.parse(fs.readFileSync(rightsPath, 'utf8')) : {};
const rightsByName = new Map(Object.entries(rights).map(([n, r]) => [n.toLowerCase(), r]));
let rightsFlagged = 0;
for (const block of Object.values(priced.positions)) {
  for (const p of block.players) {
    const r = rightsByName.get(p.name.toLowerCase());
    if (!r) continue;
    rightsFlagged++;
    // Whoever holds the rights can match the high bid. If that is you, he is
    // yours to guarantee; if it is someone else, your bid may only be setting
    // their price — and they may still let him go.
    p.rights_owner = r.owner;
    p.rights_prev = r.prev;
    p.match_right = !!r.me;
  }
}

// --- the keeper-match scenario --------------------------------------------
// A player you can take back at the room's high bid costs whatever the room
// says. Show what is left at a few plausible prices so the rest of the night
// is planned, not improvised.
const scenarios = (cfg.match_scenarios || []).map((price) => {
  const left = me.left - price;
  const spots = me.needed - 1;
  return { price, left, spots, per_spot: spots ? Number((left / spots).toFixed(1)) : 0, hard_max: hardMax({ budgetRemaining: left, spotsRemaining: spots }) };
});

// Two buy-back rights: a grid of what is left if you match BOTH at each pair
// of prices. Cells you cannot afford are marked, because the room will try
// to find exactly that pair.
let matchGrid = null;
if (cfg.match_grid) {
  const [nameA, nameB] = Object.keys(cfg.match_grid);
  const rows = cfg.match_grid[nameA], cols = cfg.match_grid[nameB];
  const spots = me.needed - 2;
  matchGrid = {
    a: nameA, b: nameB, rows, cols,
    cells: rows.map((pa) => cols.map((pb) => {
      const left = me.left - pa - pb;
      const ok = left >= spots * (cfg.min_bid ?? 1);
      return { a: pa, b: pb, left, spots, ok, hard_max: ok ? hardMax({ budgetRemaining: left, spotsRemaining: spots }) : 0 };
    })),
    // The single most useful number: the most the PAIR can cost you.
    pair_ceiling: me.left - spots * (cfg.min_bid ?? 1),
  };
}

// --- overall top-N by suggested dollars ------------------------------------
// In an auction the cross-position ordering IS the dollar ordering.
const overall = Object.entries(priced.positions)
  .flatMap(([pos, b]) => b.players.map((p) => ({ ...p, position: pos })))
  .sort((a, b) => b.max_bid_suggested - a.max_bid_suggested || a.rank_position - b.rank_position)
  .slice(0, cfg.top_n ?? 200)
  .map((p, i) => ({ ...p, overall: i + 1 }));

const out = {
  schema: 'fantasy-sports/auction@1',
  generated_at: new Date().toISOString(),
  league_name: cfg.name,
  format: board.format,
  sources: board.sources,
  captured_at: board.captured_at,
  market: {
    teams: teams.length, budget: cfg.budget,
    money_remaining: moneyRemaining, spots_remaining: spotsRemaining,
    per_spot: Number((moneyRemaining / spotsRemaining).toFixed(2)),
    idp_spots_est: idpSpots, idp_reserve_est: Math.round(unrankedReserve),
    offense_money: Math.round(priced.offenseMoney),
  },
  you: { ...you, team: me.name, hard_max: hardMax(you), scenarios, match_grid: matchGrid, keeper_match: cfg.keeper_match ?? null },
  taken: takenRows.length,
  rights_in_pool: rightsFlagged,
  teams: teams.map((t) => ({ ...t, hard_max: hardMax({ budgetRemaining: t.left, spotsRemaining: t.needed }) })),
  demand: priced.demand,
  positions: priced.positions,
  overall,
  provenance:
    `${board.sources.join(', ')} PPR board priced for ${cfg.name}: ${teams.length} teams, ` +
    `$${moneyRemaining} left across ${spotsRemaining} open spots. Suggested bids are a policy ` +
    `allocation across the ranker's tiers, never a projection. Hard max is arithmetic.`,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

console.log(`Wrote ${outPath}`);
console.log(`  market   : $${moneyRemaining} left / ${spotsRemaining} spots = $${out.market.per_spot} per spot`);
console.log(`  IDP est  : ${idpSpots} spots, ~$${Math.round(unrankedReserve)} reserved (not ranked here)`);
console.log(`  offense  : ~$${Math.round(priced.offenseMoney)} chasing ${Object.values(priced.demand).reduce((a,b)=>a+b,0)} starter slots`);
console.log(`  you      : ${me.name} — $${me.left} / ${me.needed} spots, hard max $${hardMax(you)}`);
for (const s of scenarios) console.log(`    if the match costs $${s.price}: $${s.left} for ${s.spots} spots ($${s.per_spot} each), hard max $${s.hard_max}`);
if (matchGrid) {
  console.log(`  matches  : ${matchGrid.a} + ${matchGrid.b} together can cost you at most $${matchGrid.pair_ceiling} (leaves $1 x ${matchGrid.cells[0][0].spots} spots)`);
  console.log(`             ${''.padEnd(10)}${matchGrid.cols.map((c) => ('JSN $' + c).padStart(9)).join('')}`);
  for (const row of matchGrid.cells) console.log(`             ${('Puka $' + row[0].a).padEnd(10)}${row.map((c) => (c.ok ? '$' + c.left + ' left' : '  X  ').padStart(9)).join('')}`);
}
console.log(`  taken    : ${takenRows.length} rostered players off the board`);
console.log(`  rights   : ${rightsFlagged} players IN the pool with a buy-back owner`);
for (const [pos, b] of Object.entries(priced.positions)) {
  const top = b.players.slice(0, 4).map((p) => `${p.name.split(' ').at(-1)} $${p.max_bid_suggested}`).join(', ');
  console.log(`  ${pos.padEnd(4)}: ${String(b.players.length).padStart(3)} left (${b.taken_count} gone), pool $${b.position_budget}  | ${top}`);
}
