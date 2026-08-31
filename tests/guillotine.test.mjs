import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coverDifficulty, byeRange, adjustPosition, tierBySourceSizes, byeHistogram,
  DEFAULT_BYE_WEIGHTS,
} from '../src/fantasy/guillotine.mjs';

const RANGE = { first: 5, last: 14 };
const p = (id, rank, bye) => ({ id, name: id, position: 'RB', rank_position: rank, bye, tier: Math.ceil(rank / 3) });

test('cover difficulty is 1 at the earliest bye and 0 at the latest', () => {
  assert.equal(coverDifficulty(5, RANGE), 1);
  assert.equal(coverDifficulty(14, RANGE), 0);
  assert.ok(coverDifficulty(9, RANGE) > coverDifficulty(12, RANGE), 'earlier byes must cost more');
  assert.equal(coverDifficulty(null, RANGE), 0, 'an unknown bye must not be penalised');
});

test('byeRange is discovered from the data, not assumed', () => {
  assert.deepEqual(byeRange([p('a', 1, 7), p('b', 2, 13), p('c', 3, null)]), { first: 7, last: 13 });
  assert.deepEqual(byeRange([p('a', 1, null)]), { first: 0, last: 0 });
});

test('a late bye moves a player up past an equal player with an early bye', () => {
  const players = [p('early', 1, 5), p('late', 2, 14)];
  const out = adjustPosition(players, 'RB', { range: RANGE });
  assert.equal(out[0].id, 'late', 'the late bye should now be first');
  assert.equal(out[0].moved, 1);
  assert.equal(out[1].moved, -1);
});

test('the shift is bounded by the position weight, so nobody leapfrogs the board', () => {
  const players = Array.from({ length: 30 }, (_, i) => p('p' + i, i + 1, i === 29 ? 14 : 5));
  const out = adjustPosition(players, 'RB', { range: RANGE });
  const moved = out.find((x) => x.id === 'p29');
  assert.ok(moved.moved <= DEFAULT_BYE_WEIGHTS.RB,
    `a bye swing must not move a player more than the position weight (${DEFAULT_BYE_WEIGHTS.RB}), got ${moved.moved}`);
});

test('position weights order by replaceability, not by value', () => {
  assert.ok(DEFAULT_BYE_WEIGHTS.TE > DEFAULT_BYE_WEIGHTS.WR, 'TE is harder to cover than WR');
  assert.ok(DEFAULT_BYE_WEIGHTS.RB > DEFAULT_BYE_WEIGHTS.WR, 'RB is harder to cover than WR');
  assert.ok(DEFAULT_BYE_WEIGHTS.WR > DEFAULT_BYE_WEIGHTS.K, 'a kicker week is trivially covered');
});

test('every row carries the trail back to the source rank', () => {
  const out = adjustPosition([p('a', 1, 5), p('b', 2, 14)], 'RB', { range: RANGE });
  for (const x of out) {
    assert.ok(Number.isInteger(x.source_rank), 'source rank must survive');
    assert.ok(typeof x.bye_shift === 'number', 'the bye shift must be visible');
    assert.ok(typeof x.moved === 'number', 'the move against the source must be visible');
  }
});

test('a human risk flag pushes a player down and keeps its note', () => {
  const players = [p('hurt', 1, 14), p('fine', 2, 14)];
  const out = adjustPosition(players, 'RB', {
    range: RANGE, flags: { hurt: { penalty: 20, note: 'PUP, no Week 1' } },
  });
  assert.equal(out[0].id, 'fine');
  assert.equal(out[1].flag_note, 'PUP, no Week 1');
  assert.equal(out[1].flag_shift, 20);
});

test('no invented risk score exists on a row (ADR-0002/0004)', () => {
  const [x] = adjustPosition([p('a', 1, 9)], 'RB', { range: RANGE });
  for (const banned of ['floor', 'ceiling', 'consistency', 'injury_risk', 'projection', 'points']) {
    assert.ok(!(banned in x), `guillotine rows must not carry an invented "${banned}"`);
  }
});

test('SOS is never an input to the score', () => {
  const a = adjustPosition([{ ...p('a', 1, 9), sos: 2 }], 'RB', { range: RANGE })[0];
  const b = adjustPosition([{ ...p('a', 1, 9), sos: 10 }], 'RB', { range: RANGE })[0];
  assert.equal(a.guillotine_score, b.guillotine_score, 'SOS polarity is unverified and must not move the board');
});

test("tiering keeps the ranker's tier SIZES and lets membership follow the adjustment", () => {
  const adjusted = [p('a', 1, 14), p('b', 2, 14), p('c', 3, 5), p('d', 4, 5), p('e', 5, 5)];
  const sourceTiers = [1, 1, 2, 2, 2]; // sizes 2 then 3
  const { players, sizes } = tierBySourceSizes(adjusted, sourceTiers);
  assert.deepEqual(sizes, [2, 3], "the ranker's tier sizes must survive");
  assert.deepEqual(players.map((x) => x.tier), [1, 1, 2, 2, 2]);
});

test('tiering falls back to computed breaks when the source publishes no tiers', () => {
  const adjusted = [p('a', 1, 9), p('b', 2, 9), p('c', 3, 9), p('d', 4, 9)];
  const { sizes } = tierBySourceSizes(adjusted, null, [2]);
  assert.deepEqual(sizes, [2, 2]);
});

test('no player is dropped or duplicated by tiering', () => {
  const adjusted = Array.from({ length: 11 }, (_, i) => p('p' + i, i + 1, 9));
  const { players } = tierBySourceSizes(adjusted, [1, 1, 2, 2, 3], null);
  assert.equal(players.length, 11, 'a short tier-size list must not lose the tail');
  assert.equal(new Set(players.map((x) => x.id)).size, 11);
});

test('bye histogram counts what the drafter is actually exposed to', () => {
  assert.deepEqual(byeHistogram([p('a', 1, 6), p('b', 2, 6), p('c', 3, 11), p('d', 4, null)]), { 6: 2, 11: 1 });
});
