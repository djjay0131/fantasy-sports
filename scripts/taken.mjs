#!/usr/bin/env node
// taken.mjs — mark players already on a roster as gone.
//
//   node scripts/taken.mjs --from data/processed/loda-rosters.txt
//   pbpaste | node scripts/taken.mjs --from -
//
// Input is loose on purpose: one player per line, in whatever shape a league
// site copies out. Everything after a name that looks like a team, position,
// salary or slot label is discarded, so pasted roster tables work.
//
// Names are matched through the same normalizer the ingest path uses, so
// "Ja'Marr Chase", "JaMarr Chase" and "Chase, Ja'Marr" all land on one player.
//
// Anything that does NOT match is written to a rejections file and printed.
// A silently-dropped name is a player you think is available and isn't — the
// single most expensive failure this tool could have (Principle 5).

import fs from 'node:fs';
import path from 'node:path';
import { normalizeName } from '../src/fantasy/identity/normalize.mjs';

const args = process.argv.slice(2);
const arg = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const from = arg('--from', '-');
const boardPath = arg('--board', 'docs/data/guillotine.json');
const outPath = arg('--out', 'data/processed/taken.json');
const rejectPath = arg('--rejections', 'data/processed/taken-rejections.json');

const raw = from === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(from, 'utf8');
const board = JSON.parse(fs.readFileSync(boardPath, 'utf8'));

// Index every player by a few spellings so a paste has more than one way in.
const index = new Map();
const add = (k, p) => { if (k && !index.has(k)) index.set(k, p); };
for (const block of Object.values(board.positions)) {
  for (const p of block.players) {
    const n = normalizeName(p.name);
    add(n, p);
    add(`${n}|${(p.team || '').toLowerCase()}`, p);
    const parts = n.split(' ');
    if (parts.length > 1) add(`${parts.at(-1)} ${parts[0]}`, p); // "chase jamarr"
  }
}

const TRAILING_JUNK = /\s+(QB|RB|WR|TE|K|DST|D\/ST|DEF|FLEX|BE|IR|BN|Bench|Starter)\b.*$/i;
const LEADING_SLOT = /^\s*(QB|RB|WR|TE|K|DST|D\/ST|DEF|FLEX|BE|IR|BN)\s+/i;
const MONEY = /\$\s*\d+/g;

const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const matched = new Map();
const rejections = [];

for (const line of lines) {
  const salary = (line.match(MONEY) || [])[0] || null;
  let s = line.replace(MONEY, ' ').replace(LEADING_SLOT, '').replace(TRAILING_JUNK, '');
  s = s.split(/\s{2,}|\t|\s+\|\s+/)[0];                 // first column of a table row
  if (/^(name|player|team|total|bench|starters?)$/i.test(s.trim())) continue;  // header rows
  if (s.includes(',')) s = s.split(',').map((x) => x.trim()).reverse().join(' '); // "Chase, Ja'Marr"

  const n = normalizeName(s);
  if (!n || n.length < 3) continue;

  const hit = index.get(n) || index.get(n.split(' ').reverse().join(' '));
  if (hit) {
    matched.set(hit.id, { id: hit.id, name: hit.name, position: hit.position, team: hit.team, salary });
  } else {
    rejections.push({ line, parsed: s.trim(), reason: 'no player on the board matches this name' });
  }
}

for (const p of [outPath, rejectPath]) fs.mkdirSync(path.dirname(p), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify([...matched.values()], null, 2) + '\n');
fs.writeFileSync(rejectPath, JSON.stringify(rejections, null, 2) + '\n');

console.log(`Matched ${matched.size} of ${lines.length} line(s) -> ${outPath}`);
const withSalary = [...matched.values()].filter((p) => p.salary).length;
if (withSalary) console.log(`  ${withSalary} carried a salary`);
if (rejections.length) {
  console.log(`\n${rejections.length} line(s) did NOT match. These are players you would think are`);
  console.log(`available. Check them before you bid:`);
  for (const r of rejections.slice(0, 25)) console.log(`  "${r.parsed}"   (from: ${r.line.slice(0, 60)})`);
  if (rejections.length > 25) console.log(`  ... and ${rejections.length - 25} more in ${rejectPath}`);
}
