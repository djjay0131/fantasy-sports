#!/usr/bin/env node
// keeper-draft.mjs — turn a keeper league's config into a draft-slot file the
// board can pre-fill.
//
//   node scripts/keeper-draft.mjs data/processed/foxwoods-league.json
//
// Reads {teams, rounds, order, me, keepers:[{team, round, name, pos}]} and the
// ranker's board (docs/data/rankings.json), resolves every keeper to a board
// id, and writes docs/data/<league>-draft.json:
//   { league, me, lineup, scoring, slots:[{n, round, team, mine, keeper|null}] }
// A keeper that does not resolve is kept with id:null and listed under
// `unresolved` — never silently dropped (Principle 5). Output is git-ignored:
// it is derived from the ranker's board (ADR-0001).

import fs from 'node:fs';
import path from 'node:path';
import { normalizeName } from '../src/fantasy/identity/normalize.mjs';
import { buildSlots } from '../src/fantasy/keeper-draft.mjs';

const cfgPath = process.argv[2];
if (!cfgPath) { console.error('usage: keeper-draft.mjs <league-config.json>'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const board = JSON.parse(fs.readFileSync(path.resolve('docs/data/rankings.json'), 'utf8'));

const idx = new Map();
for (const [pos, blk] of Object.entries(board.positions)) {
  for (const p of blk.players) {
    const hit = { id: p.id, name: p.name, pos, board: `${pos}${p.rank_position}`, tier: p.tier };
    idx.set(`${normalizeName(p.name)}|${pos}`, hit);
    if (!idx.has(normalizeName(p.name))) idx.set(normalizeName(p.name), hit);
  }
}

const teams = cfg.order.length;
if (teams !== cfg.teams) throw new Error(`order has ${teams} teams, config says ${cfg.teams}`);
const rounds = cfg.draft.rounds;
const unresolved = [];
const keepers = cfg.keepers.map((k) => {
  const hit = idx.get(`${normalizeName(k.name)}|${k.pos}`) || idx.get(normalizeName(k.name)) || null;
  if (!hit) unresolved.push(k);
  return { ...k, id: hit?.id ?? null, board: hit?.board ?? null, tier: hit?.tier ?? null };
});
const slots = buildSlots({ order: cfg.order, rounds, keepers, me: cfg.me }).map((s) => ({
  ...s, keeper: s.keeper ? { name: s.keeper.name, pos: s.keeper.pos, nfl: s.keeper.nfl, id: s.keeper.id, board: s.keeper.board, tier: s.keeper.tier } : null,
}));

const out = {
  league: cfg.league, name: cfg.name, site: cfg.site, me: cfg.me, teams, rounds, draft: cfg.draft,
  lineup: cfg.lineup, scoring: cfg.scoring, order: cfg.order, generated_at: new Date().toISOString(),
  board_captured: board.captured_at?.last ?? null, keepers: cfg.keepers.length, unresolved, slots,
};
const dest = path.resolve(`docs/data/${cfg.league}-draft.json`);
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
const mine = slots.filter((s) => s.mine);
console.log(`${dest}: ${slots.length} slots, ${cfg.keepers.length} keepers (${unresolved.length} unresolved)`);
console.log(`your picks: ${mine.map((s) => s.keeper ? `${s.n}=${s.keeper.name}` : s.n).join(', ')}`);
if (unresolved.length) console.log('unresolved:', unresolved.map((k) => `${k.name} ${k.pos}`).join('; '));
