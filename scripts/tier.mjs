#!/usr/bin/env node
// tier.mjs — normalized rows in, a tiered board out.
//
//   node scripts/tier.mjs --in data/processed/rows.json \
//                         --out docs/data/rankings.json \
//                         --format ppr-1qb-12
//
// The output path is git-ignored by default (ADR-0001). The one exception
// the repo tracks is docs/data/rankings.sample.json, and writing to it is a
// deliberate act: pass --allow-sample.

import fs from 'node:fs';
import path from 'node:path';
import { reconcile, groupByPosition } from '../src/fantasy/reconcile.mjs';
import { tierPosition } from '../src/fantasy/tiering.mjs';
import { parseFormat, DEFAULT_FORMAT, POSITIONS } from '../src/fantasy/format.mjs';

const args = process.argv.slice(2);
const arg = (f, d = null) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};

const inPath = arg('--in');
const outPath = arg('--out', 'docs/data/rankings.json');
const formatId = arg('--format', DEFAULT_FORMAT);
const overridePath = arg('--overrides', 'data/processed/tier-overrides.json');

if (!inPath) {
  console.error('usage: node scripts/tier.mjs --in <rows.json> [--out <board.json>] [--format <id>]');
  process.exit(2);
}
if (path.basename(outPath) === 'rankings.sample.json' && !args.includes('--allow-sample')) {
  console.error(
    'Refusing to write the committed sample dataset without --allow-sample.\n' +
    'The sample is the ONLY ranking data tracked in this public repo, and it must\n' +
    'come from a freely available source (ADR-0001).'
  );
  process.exit(2);
}

const format = parseFormat(formatId);
const rows = JSON.parse(fs.readFileSync(inPath, 'utf8'));

// Guard the format boundary: a row from another format silently averaged in
// would be wrong in a way nothing downstream could detect.
const wrong = rows.filter((r) => r.format?.id && r.format.id !== formatId);
if (wrong.length) {
  console.error(`${wrong.length} row(s) carry a different format than --format ${formatId}. Refusing.`);
  process.exit(1);
}

const overrides = fs.existsSync(overridePath)
  ? JSON.parse(fs.readFileSync(overridePath, 'utf8'))
  : {};

const consensus = reconcile(rows);
const byPos = groupByPosition(consensus);
const sources = [...new Set(rows.map((r) => r.source))];

// Where the source carries ADP, derive each player's positional rank BY ADP
// and record how far the ranker sits from the field. Both are ordinal, so
// the comparison is legitimate (ADR-0002): a positive `vs_adp` means this
// source rates the player higher than the draft room does — a value — and a
// negative one means the room likes him more than the source does.
function annotateVsAdp(players) {
  const withAdp = players.filter((p) => p.adp != null).sort((a, b) => a.adp - b.adp);
  const adpRank = new Map(withAdp.map((p, i) => [p.id, i + 1]));
  const byRank = [...players].sort((a, b) => a.mean - b.mean);
  byRank.forEach((p, i) => {
    const r = adpRank.get(p.id);
    p.adp_position = r ?? null;
    p.vs_adp = r == null ? null : r - (i + 1);
  });
  return players;
}

const positions = {};
for (const pos of POSITIONS) {
  const players = byPos.get(pos);
  if (!players?.length) continue;
  annotateVsAdp(players);
  const o = overrides[pos] || {};
  // With one source, that source's own tiers win where it publishes them
  // (ADR-0003). With several, nobody's tiering is authoritative over the
  // consensus, so the breaks are computed.
  positions[pos] = tierPosition(players, {
    accepted: o.accepted_breaks ?? null,
    note: o.note ?? null,
    sourceTiersFrom: sources.length === 1 ? sources[0] : null,
  });
}

const captured = rows.map((r) => r.captured_at).filter(Boolean).sort();

const board = {
  schema: 'fantasy-sports/board@1',
  generated_at: new Date().toISOString(),
  format,
  sources,
  captured_at: { first: captured[0] ?? null, last: captured.at(-1) ?? null },
  provenance:
    sources.length > 1
      ? `Consensus of ${sources.length} sources.`
      : `Single source: ${sources[0] ?? 'unknown'}. Tier breaks fall back to raw gap.`,
  positions,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(board, null, 2) + '\n');

console.log(`Wrote ${outPath}`);
console.log(`  format   : ${format.label}`);
console.log(`  sources  : ${sources.join(', ') || '(none)'}`);
for (const [pos, p] of Object.entries(positions)) {
  const tiers = p.players.at(-1)?.tier ?? 0;
  console.log(`  ${pos.padEnd(4)}: ${String(p.players.length).padStart(3)} players, ${String(tiers).padStart(2)} tiers  [${p.method}]`);
}
