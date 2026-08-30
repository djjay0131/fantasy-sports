import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/fantasy/sources/fantasyguru.mjs';
import { tierPosition, breaksFromSourceTiers } from '../src/fantasy/tiering.mjs';

const HEAD = '<table><thead><tr><th>Rank</th><th>Tier</th><th>Player</th><th>Team</th><th>Bye</th><th>ADP</th><th>SOS</th></tr></thead><tbody>';
const row = (r, t, n, tm, bye, adp, sos) =>
  `<tr><td>${r}</td><td>${t}</td><td>${n}</td><td>${tm}</td><td>${bye}</td><td>${adp}</td><td>${sos}</td></tr>`;

// Two blocks: DST (franchises, untiered) then QB (tiered). Rank restarts at 1.
const TWO_BLOCKS =
  HEAD +
  row(1, '', 'Houston Texans', 'HOU', 8, '', 8) +
  row(2, '', 'Denver Broncos', 'DEN', 10, '', 4) +
  row(1, 1, 'Josh Allen', 'BUF', 7, 19, 6) +
  row(2, 2, 'Lamar Jackson', 'BAL', 13, 35, 6) +
  row(3, 2, 'Drake Maye', 'NE', 11, 56, 8) +
  '</tbody></table>';

test('splits stacked position blocks on the rank reset', () => {
  const { players, rejections } = parse(TWO_BLOCKS, { blockOrder: ['DST', 'QB'] });
  assert.equal(rejections.length, 0);
  assert.deepEqual(players.map((p) => p.position), ['DST', 'DST', 'QB', 'QB', 'QB']);
  assert.deepEqual(players.map((p) => p.rank_position), [1, 2, 1, 2, 3]);
});

test("carries the ranker's own tier, and null where the source has none", () => {
  const { players } = parse(TWO_BLOCKS, { blockOrder: ['DST', 'QB'] });
  assert.equal(players[0].source_tier, null, 'DST is untiered in this export');
  assert.deepEqual(players.slice(2).map((p) => p.source_tier), [1, 2, 2]);
});

test('keeps ADP and bye, and synthesizes no point total (ADR-0002)', () => {
  const { players } = parse(TWO_BLOCKS, { blockOrder: ['DST', 'QB'] });
  const allen = players.find((p) => p.name === 'Josh Allen');
  assert.equal(allen.adp, 19);
  assert.equal(allen.bye, 7);
  assert.equal(allen.team, 'BUF');
  assert.ok(!('points' in allen) && !('projection' in allen), 'no projected value may exist on a row');
});

test('REFUSES to label blocks when the declared order does not fit', () => {
  // Declared order says QB comes first, but block 1 is franchises.
  const { players, rejections } = parse(TWO_BLOCKS, { blockOrder: ['QB', 'DST'] });
  assert.equal(players.length, 0, 'nothing may be emitted from a wrong hypothesis');
  assert.match(rejections[0].reason, /NFL franchises/);
});

test('REFUSES when the block count does not match the declared order', () => {
  const { players, rejections } = parse(TWO_BLOCKS, { blockOrder: ['DST', 'QB', 'RB'] });
  assert.equal(players.length, 0);
  assert.match(rejections[0].reason, /2 position blocks but the declared order names 3/);
});

test('a capture with no table is a rejection, not a crash', () => {
  const { players, rejections } = parse('<html><body><p>frameset</p></body></html>', {});
  assert.equal(players.length, 0);
  assert.ok(rejections.length);
});

// ---- ADR-0003: source tiers win over computed ones -------------------------

const withSourceTiers = (tiers) =>
  tiers.map((t, i) => ({ id: 'p' + i, name: 'P' + i, position: 'RB', mean: i + 1, sd: 0, sources: 1, source_tiers: { guru: t } }));

test('source tiers become the breaks when the source supplies all of them', () => {
  const players = withSourceTiers([1, 1, 2, 2, 2, 3]);
  assert.deepEqual(breaksFromSourceTiers(players, 'guru'), [2, 5]);
  const r = tierPosition(players, { sourceTiersFrom: 'guru' });
  assert.equal(r.tier_source, 'guru');
  assert.deepEqual(r.players.map((p) => p.tier), [1, 1, 2, 2, 2, 3]);
  assert.match(r.method, /published by guru/);
});

test('a partially tiered position falls back to computed, never half-authored', () => {
  const players = withSourceTiers([1, 1, null, 2, 2, 3]);
  assert.equal(breaksFromSourceTiers(players, 'guru'), null);
  assert.equal(tierPosition(players, { sourceTiersFrom: 'guru' }).tier_source, 'computed');
});

test('the computed breaks survive alongside the source tiers', () => {
  const r = tierPosition(withSourceTiers([1, 1, 2, 2, 2, 3]), { sourceTiersFrom: 'guru' });
  assert.ok(Array.isArray(r.computed_breaks), 'the algorithm must stay inspectable');
  assert.deepEqual(r.source_breaks, [2, 5]);
});

test('a human override outranks even the source tiers, and records what it replaced', () => {
  const r = tierPosition(withSourceTiers([1, 1, 2, 2, 2, 3]), { sourceTiersFrom: 'guru', accepted: [3], note: 'bye stack' });
  assert.equal(r.tier_source, 'human override');
  assert.deepEqual(r.source_breaks, [2, 5], "the source's tiering must survive the override");
  assert.deepEqual(r.players.map((p) => p.tier), [1, 1, 1, 2, 2, 2]);
});
