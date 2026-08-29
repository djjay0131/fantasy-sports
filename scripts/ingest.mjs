#!/usr/bin/env node
// ingest.mjs — one raw capture in, canonical rows plus a run report out.
//
//   node scripts/ingest.mjs --source fantasyguru \
//                           --capture data/raw/fantasyguru/2026-08-29T14-02-11-RB.json \
//                           --format ppr-1qb-12
//
// Principle 2: the capture is never modified, and everything here must be
// re-derivable from it. Principle 5: rejections are written, never dropped.

import fs from 'node:fs';
import path from 'node:path';
import { Resolver } from '../src/fantasy/identity/resolver.mjs';
import { parseFormat, DEFAULT_FORMAT } from '../src/fantasy/format.mjs';

const args = process.argv.slice(2);
const arg = (f, d = null) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};

const sourceId = arg('--source');
const capturePath = arg('--capture');
const formatId = arg('--format', DEFAULT_FORMAT);
const outPath = arg('--out', 'data/processed/rows.json');
const aliasPath = arg('--aliases', 'src/fantasy/identity/aliases.json');
const rejectPath = arg('--rejections', 'data/processed/rejections.json');

if (!sourceId || !capturePath) {
  console.error('usage: node scripts/ingest.mjs --source <id> --capture <file> [--format <id>]');
  process.exit(2);
}

const format = parseFormat(formatId);
const { parse } = await import(`../src/fantasy/sources/${sourceId}.mjs`);

const raw = fs.readFileSync(capturePath, 'utf8');
const capturedAt = captureTimestamp(capturePath);
const parsed = parse(raw, { format, capturedAt });

const table = fs.existsSync(aliasPath) ? JSON.parse(fs.readFileSync(aliasPath, 'utf8')) : {};
const resolver = new Resolver(table);

const rows = [];
const rejections = [...(parsed.rejections || [])];

for (const p of parsed.players) {
  const r = resolver.resolve(p);
  if (!r.ok) {
    rejections.push({ ...p, reason: r.reason, source: sourceId, captured_at: capturedAt });
    continue;
  }
  rows.push({
    source: sourceId,
    captured_at: capturedAt,
    format,
    position: p.position,
    player: { id: r.id, name: p.name, team: p.team ?? null, bye: p.bye ?? null },
    rank_position: p.rank_position,
    rank_overall: p.rank_overall ?? null,
  });
}

// Merge with any rows already ingested for other positions or sources.
const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : [];
const key = (r) => `${r.source}|${r.format.id}|${r.position}|${r.player.id}`;
const merged = new Map(existing.map((r) => [key(r), r]));
for (const r of rows) merged.set(key(r), r);

write(outPath, [...merged.values()]);
write(rejectPath, rejections);

const minted = resolver.mintedRows();
console.log(`Ingested ${rows.length} rows from ${path.basename(capturePath)}`);
console.log(`  source     : ${sourceId}`);
console.log(`  format     : ${format.label}`);
console.log(`  captured   : ${capturedAt}`);
console.log(`  rejections : ${rejections.length}${rejections.length ? ` -> ${rejectPath}` : ''}`);
console.log(`  new IDs    : ${minted.length} provisional — promote into ${aliasPath} after review`);
for (const m of minted.slice(0, 15)) console.log(`      ${m.id}  (${m.name}, ${m.team ?? '?'})`);
if (minted.length > 15) console.log(`      ... and ${minted.length - 15} more`);
if (rejections.length) {
  console.log('\nRejections are retained, not dropped (Principle 5). Review them:');
  for (const r of rejections.slice(0, 10)) console.log(`      ${r.name ?? '(no name)'} — ${r.reason}`);
}

function write(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

function captureTimestamp(p) {
  const m = path.basename(p).match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`;
  return fs.statSync(p).mtime.toISOString();
}
