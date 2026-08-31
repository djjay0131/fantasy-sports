#!/usr/bin/env node
// guillotine.mjs — build the Guillotine board from an existing PPR board.
//
//   node scripts/guillotine.mjs --in docs/data/rankings.json \
//                               --out docs/data/guillotine.json \
//                               --teams 18
//
// Input is the board `scripts/tier.mjs` already produced, so the ranker's
// ordering and tiers arrive intact (ADR-0003) and this stage only applies the
// format's own adjustments (ADR-0004). Output is git-ignored like every other
// derived board (ADR-0001).
//
// Human risk flags live in data/processed/guillotine-flags.json:
//   { "<player id>": { "penalty": 12, "note": "PUP list, no Week 1" } }
// They are the ONLY risk input: this pipeline has no injury feed and will not
// invent one.

import fs from 'node:fs';
import path from 'node:path';
import {
  adjustPosition, tierBySourceSizes, byeRange, byeHistogram,
  DEFAULT_BYE_WEIGHTS, DEFAULT_LEAGUE,
} from '../src/fantasy/guillotine.mjs';

const args = process.argv.slice(2);
const arg = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const inPath = arg('--in', 'docs/data/rankings.json');
const outPath = arg('--out', 'docs/data/guillotine.json');
const flagsPath = arg('--flags', 'data/processed/guillotine-flags.json');
const teams = Number(arg('--teams', DEFAULT_LEAGUE.teams));

if (!fs.existsSync(inPath)) {
  console.error(`No board at ${inPath}. Build one first:\n  node scripts/refresh.mjs`);
  process.exit(2);
}

const src = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const flags = fs.existsSync(flagsPath) ? JSON.parse(fs.readFileSync(flagsPath, 'utf8')) : {};

// One bye range across the whole board, so a Week-5 bye costs the same
// "earliness" at every position.
const all = Object.values(src.positions).flatMap((p) => p.players);
const range = byeRange(all);

const positions = {};
for (const [pos, block] of Object.entries(src.positions)) {
  const adjusted = adjustPosition(block.players, pos, { flags, range, byeWeights: DEFAULT_BYE_WEIGHTS });
  const sourceTiers = block.tier_source && block.tier_source !== 'computed'
    ? block.players.map((p) => p.tier)
    : null;
  const { players, sizes } = tierBySourceSizes(adjusted, sourceTiers, block.computed_breaks);

  positions[pos] = {
    players,
    tier_sizes: sizes,
    tier_basis: sourceTiers
      ? `${block.tier_source}'s tier sizes, membership re-ordered for guillotine`
      : 'computed tier sizes, membership re-ordered for guillotine',
    bye_weight: DEFAULT_BYE_WEIGHTS[pos] ?? 5,
    byes: byeHistogram(players),
    moved: players.filter((p) => p.moved !== 0).length,
  };
}

const board = {
  schema: 'fantasy-sports/guillotine@1',
  generated_at: new Date().toISOString(),
  derived_from: { schema: src.schema, generated_at: src.generated_at, sources: src.sources },
  // `format` is the SCORING format and comes from the source board; league
  // size is a separate axis and the source's own label bakes in a team count
  // that does not apply here. Compose a display label rather than reusing one
  // that would read "12-team" on an 18-team board.
  format: { ...src.format, label: `${src.format.label.split(' / ').slice(0, 2).join(' / ')} / ${teams}-team guillotine` },
  scoring_format: src.format,
  league: { ...DEFAULT_LEAGUE, teams },
  sources: src.sources,
  captured_at: src.captured_at,
  bye_range: range,
  bye_weights: DEFAULT_BYE_WEIGHTS,
  flags_applied: Object.keys(flags).length,
  provenance:
    `Guillotine re-rank of the ${(src.sources || []).join(', ')} board. Ordering and tier sizes are ` +
    `the ranker's; the shifts are bye-week cover difficulty for a ${teams}-team league, plus any ` +
    `human risk flags. SOS is shown but never computed with — its polarity is undocumented.`,
  positions,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(board, null, 2) + '\n');

console.log(`Wrote ${outPath}`);
console.log(`  league   : ${teams}-team guillotine, ${board.format.label}`);
console.log(`  byes     : weeks ${range.first}-${range.last}`);
console.log(`  flags    : ${Object.keys(flags).length} human risk flag(s)`);
for (const [pos, p] of Object.entries(positions)) {
  const top = p.players.slice(0, 3).map((x) => `${x.name.split(' ').slice(-1)[0]}${x.moved > 0 ? ` (+${x.moved})` : x.moved < 0 ? ` (${x.moved})` : ''}`);
  console.log(`  ${pos.padEnd(4)}: ${String(p.players.length).padStart(3)} players, ${p.moved} moved, bye weight ${p.bye_weight}  | top: ${top.join(', ')}`);
}
