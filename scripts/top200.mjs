#!/usr/bin/env node
// top200.mjs — the ranker's OVERALL board, joined to his positional tiers.
//
//   node scripts/top200.mjs [--in <capture.tsv>] [--board docs/data/rankings.json]
//
// The overall export has no tier column; the positional export has tiers but
// no overall order. Joining them by player gives one board with both — his
// overall rank for sequencing a snake draft, his positional tier for knowing
// when the cliff falls. Output is git-ignored (ADR-0001).

import fs from 'node:fs';
import path from 'node:path';
import { normalizeName } from '../src/fantasy/identity/normalize.mjs';

const args = process.argv.slice(2);
const arg = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const RAW_DIR = 'data/raw/fantasyguru';
const inPath = arg('--in') || (() => {
  const fs_ = fs.readdirSync(RAW_DIR).filter((f) => /top200\.tsv$/.test(f)).sort();
  if (!fs_.length) { console.error('no top200 capture in ' + RAW_DIR); process.exit(2); }
  return path.join(RAW_DIR, fs_.at(-1));
})();
const boardPath = arg('--board', 'docs/data/rankings.json');
const outPath = arg('--out', 'docs/data/top200.json');

const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const byName = new Map();
for (const [pos, b] of Object.entries(board.positions)) {
  for (const p of b.players) byName.set(normalizeName(p.name), { ...p, position: pos });
}

const lines = fs.readFileSync(inPath, 'utf8').split(/\r?\n/).filter((l) => l.trim() && !/^Page \d/.test(l));
const hdr = lines[0].split('\t').map((h) => h.trim().toLowerCase());
const col = (n) => hdr.indexOf(n);
const num = (s) => { const c = String(s ?? '').replace(/[^\d.-]/g, ''); return c === '' || c === '-' ? null : Number(c); };

const players = [];
const rejections = [];
for (const line of lines.slice(1)) {
  const c = line.split('\t');
  const name = (c[col('player')] || '').trim();
  const rank = num(c[col('rank')]);
  if (!name || rank == null) continue;
  const hit = byName.get(normalizeName(name));
  if (!hit) {
    // Retained, never dropped (Principle 5): a player on his overall board
    // but not his positional one is a real discrepancy worth seeing.
    rejections.push({ rank, name, reason: 'not on the positional board' });
    players.push({ overall: rank, name, team: (c[col('team')] || '').trim(), bye: num(c[col('bye')]), adp: num(c[col('adp')]), position: null, rank_position: null, tier: null, id: 'top200-' + rank });
    continue;
  }
  players.push({
    overall: rank, id: hit.id, name: hit.name, team: hit.team, bye: hit.bye ?? num(c[col('bye')]),
    adp: num(c[col('adp')]), position: hit.position, rank_position: hit.rank_position, tier: hit.tier,
    sos: num(c[col('sos')]),
  });
}
players.sort((a, b) => a.overall - b.overall);

const capturedAt = (path.basename(inPath).match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/) || []).slice(1);
const out = {
  schema: 'fantasy-sports/top200@1',
  generated_at: new Date().toISOString(),
  captured_at: capturedAt.length ? `${capturedAt[0]}T${capturedAt[1]}:${capturedAt[2]}:${capturedAt[3]}Z` : null,
  sources: board.sources, format: board.format,
  provenance: `${board.sources.join(', ')}'s own overall PPR board, joined to his positional tiers by player.`,
  unmatched: rejections,
  players,
};
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${outPath}: ${players.length} players, ${rejections.length} not matched to the positional board`);
for (const r of rejections.slice(0, 10)) console.log(`   #${r.rank} ${r.name} — ${r.reason}`);
