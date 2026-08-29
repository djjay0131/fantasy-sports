import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBreaks, tierPosition, median, mad } from '../src/fantasy/tiering.mjs';
import { reconcile } from '../src/fantasy/reconcile.mjs';
import { normalizeName, normalizeTeam, slug } from '../src/fantasy/identity/normalize.mjs';
import { Resolver } from '../src/fantasy/identity/resolver.mjs';
import { parseFormat } from '../src/fantasy/format.mjs';

const p = (name, mean, sd) => ({ id: name, name, position: 'RB', mean, sd, sources: 3 });

test('median and mad', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(mad([1, 2, 3, 100]), 1);
});

test('a clear cliff produces a break, a smooth run does not', () => {
  const cliff = [p('a', 1, 0.3), p('b', 2, 0.3), p('c', 3, 0.3), p('d', 20, 0.3), p('e', 21, 0.3), p('f', 22, 0.3)];
  const { breaks } = computeBreaks(cliff);
  assert.ok(breaks.includes(3), `expected a break before the cliff, got ${JSON.stringify(breaks)}`);

  const smooth = Array.from({ length: 12 }, (_, i) => p(`s${i}`, i + 1, 0.3));
  const { breaks: b2 } = computeBreaks(smooth, { maxTier: 99 });
  assert.equal(b2.length, 0, `a uniform run should not be split, got ${JSON.stringify(b2)}`);
});

test('disagreement NARROWS a break', () => {
  // Same mean gap either side; only the spread differs.
  const agree = [p('a', 1, 0.1), p('b', 2, 0.1), p('c', 3, 0.1), p('d', 9, 0.1), p('e', 10, 0.1), p('f', 11, 0.1)];
  const argue = [p('a', 1, 6.0), p('b', 2, 6.0), p('c', 3, 6.0), p('d', 9, 6.0), p('e', 10, 6.0), p('f', 11, 6.0)];
  const sepAgree = computeBreaks(agree).separations[2];
  const sepArgue = computeBreaks(argue).separations[2];
  assert.ok(sepAgree > sepArgue, 'sources that agree should show a larger separation than sources that argue');
});

test('a human override is recorded alongside the computed value, not instead of it', () => {
  const players = [p('a', 1, 0.3), p('b', 2, 0.3), p('c', 3, 0.3), p('d', 20, 0.3), p('e', 21, 0.3)];
  const r = tierPosition(players, { accepted: [2], note: 'bye-week artifact' });
  assert.deepEqual(r.accepted_breaks, [2]);
  assert.ok(r.computed_breaks.length > 0, 'the computed value must survive the override');
  assert.equal(r.override_note, 'bye-week artifact');
  assert.equal(r.players[2].tier, 2, 'the accepted break is what tiers the board');
});

test('maxTier forces a split so no tier becomes unusable', () => {
  const flat = Array.from({ length: 30 }, (_, i) => p(`f${i}`, i + 1, 0.3));
  const { breaks } = computeBreaks(flat, { maxTier: 6 });
  assert.ok(breaks.length >= 4, `expected forced splits, got ${JSON.stringify(breaks)}`);
});

test('reconcile keeps per-source ranks and the spread', () => {
  const rows = ['s1', 's2', 's3'].map((s, i) => ({
    source: s, position: 'WR', rank_position: 1 + i,
    player: { id: 'x', name: 'X', team: 'BUF' },
  }));
  const [c] = reconcile(rows);
  assert.equal(c.sources, 3);
  assert.equal(c.mean, 2);
  assert.ok(c.sd > 0, 'disagreement must survive aggregation');
  assert.deepEqual([c.min, c.max], [1, 3]);
});

test('identity normalization', () => {
  assert.equal(normalizeName("Ja'Marr Chase"), 'jamarr chase');
  assert.equal(normalizeName('Michael Pittman Jr.'), 'michael pittman');
  assert.equal(normalizeTeam('JAC'), 'JAX');
  assert.equal(slug('Bijan Robinson', 'RB'), 'bijan-robinson-rb');
});

test('an unresolvable row is a rejection, never silently dropped', () => {
  const r = new Resolver();
  assert.equal(r.resolve({ name: '', position: 'RB' }).ok, false);
  const hit = r.resolve({ name: 'Bijan Robinson', team: 'ATL', position: 'RB' });
  assert.equal(hit.ok, true);
  assert.equal(hit.minted, true);
  assert.equal(r.resolve({ name: 'Bijan Robinson', team: 'ATL', position: 'RB' }).id, hit.id);
  assert.equal(r.mintedRows().length, 1);
});

test('an unknown scoring format is refused, never defaulted (ADR-0002)', () => {
  assert.throws(() => parseFormat('made-up'), /Unknown scoring format/);
  assert.equal(parseFormat('ppr-1qb-12').ppr, 1.0);
});
