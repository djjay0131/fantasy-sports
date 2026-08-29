#!/usr/bin/env node
// make-sample.mjs — build the committed sample board.
//
// The sample exists to demonstrate the tool, and it must be free of any
// licence question (ADR-0001). It is therefore NOT scraped from a rankings
// provider: it is an illustrative ordering, perturbed into three synthetic
// "sources" so the spread and tier machinery is visible on the page.
//
// It is not draft advice and the page says so.
//
//   node scripts/make-sample.mjs

import fs from 'node:fs';
import { reconcile, groupByPosition } from '../src/fantasy/reconcile.mjs';
import { tierPosition } from '../src/fantasy/tiering.mjs';
import { parseFormat, POSITIONS } from '../src/fantasy/format.mjs';
import { slug } from '../src/fantasy/identity/normalize.mjs';

const BASE = JSON.parse(fs.readFileSync(new URL('./sample-base.json', import.meta.url), 'utf8'));
const format = parseFormat('ppr-1qb-12');
const CAPTURED = '2026-08-29T12:00:00Z';

// Deterministic PRNG so the committed file is reproducible.
let seed = 20260829;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// Three synthetic panelists. Each shuffles the base order locally: the
// further down a position, the more they disagree — which is how real
// rankings behave, and what makes the tier machinery worth showing.
const PANELISTS = ['panel-a', 'panel-b', 'panel-c'];

const rows = [];
for (const [position, names] of Object.entries(BASE.positions)) {
  for (const source of PANELISTS) {
    const jittered = names.map((entry, i) => {
      const noise = (rnd() - 0.5) * 2 * (1.0 + i * 0.22);
      return { entry, key: i + noise };
    }).sort((a, b) => a.key - b.key);

    jittered.forEach(({ entry }, i) => {
      const [name, team, bye] = entry;
      rows.push({
        source,
        captured_at: CAPTURED,
        format,
        position,
        player: { id: `${slug(name, position)}${team ? '-' + team.toLowerCase() : ''}`, name, team, bye },
        rank_position: i + 1,
      });
    });
  }
}

const consensus = reconcile(rows);
const byPos = groupByPosition(consensus);
const positions = {};
for (const pos of POSITIONS) {
  const players = byPos.get(pos);
  if (players?.length) positions[pos] = tierPosition(players);
}

const board = {
  schema: 'fantasy-sports/board@1',
  _sample: true,
  generated_at: new Date().toISOString(),
  format,
  sources: PANELISTS,
  captured_at: { first: CAPTURED, last: CAPTURED },
  provenance:
    'Illustrative sample. The ordering was generated for demonstration and perturbed into three ' +
    'synthetic panelists so the spread and tier machinery is visible. It is not sourced from any ' +
    'rankings provider and it is not draft advice.',
  positions,
};

const out = 'docs/data/rankings.sample.json';
fs.writeFileSync(out, JSON.stringify(board, null, 2) + '\n');
console.log(`Wrote ${out}`);
for (const [pos, p] of Object.entries(positions)) {
  console.log(`  ${pos.padEnd(4)}: ${p.players.length} players, ${p.players.at(-1).tier} tiers  [${p.method}]`);
}
