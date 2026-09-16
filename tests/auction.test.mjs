import test from 'node:test';
import assert from 'node:assert/strict';
import { hardMax, tierBudget, priceposition, leagueDemand, priceBoard, DEFAULT_ROSTER } from '../src/fantasy/auction.mjs';

const P = (id, tier) => ({ id, name: id, position: 'RB', tier });

// ---- the ceiling is arithmetic; it has to be exactly right ------------------

test('hard max leaves a dollar for every other open spot', () => {
  assert.equal(hardMax({ budgetRemaining: 200, spotsRemaining: 10 }), 191);
  assert.equal(hardMax({ budgetRemaining: 200, spotsRemaining: 1 }), 200);
  assert.equal(hardMax({ budgetRemaining: 37, spotsRemaining: 5 }), 33);
});

test('hard max never goes negative or exceeds the budget', () => {
  assert.equal(hardMax({ budgetRemaining: 3, spotsRemaining: 9 }), 0);
  assert.equal(hardMax({ budgetRemaining: 0, spotsRemaining: 4 }), 0);
  assert.equal(hardMax({ budgetRemaining: 50, spotsRemaining: 0 }), 0, 'a full roster can bid nothing');
});

test('a higher min bid lowers the ceiling', () => {
  assert.ok(hardMax({ budgetRemaining: 200, spotsRemaining: 10, minBid: 2 })
          < hardMax({ budgetRemaining: 200, spotsRemaining: 10, minBid: 1 }));
});

// ---- the policy figure -----------------------------------------------------

test('an earlier tier is worth more than a later one', () => {
  const players = [P('a', 1), P('b', 1), P('c', 2), P('d', 2), P('e', 3), P('f', 3)];
  const t = tierBudget({ players, positionBudget: 600, demand: 6 });
  assert.ok(t.get(1) > t.get(2), 'tier 1 must outprice tier 2');
  assert.ok(t.get(2) > t.get(3), 'tier 2 must outprice tier 3');
});

test('the tier budget does not overspend the position budget', () => {
  const players = Array.from({ length: 12 }, (_, i) => P('p' + i, Math.floor(i / 3) + 1));
  const budget = 500;
  const t = tierBudget({ players, positionBudget: budget, demand: 12 });
  const spend = players.reduce((sum, p) => sum + t.get(p.tier), 0);
  assert.ok(spend <= budget + 1, `allocated ${spend.toFixed(0)} against a ${budget} budget`);
});

test('players past the league demand line price at the minimum', () => {
  const players = Array.from({ length: 10 }, (_, i) => P('p' + i, Math.floor(i / 2) + 1));
  const priced = priceposition(players, {
    positionBudget: 400, demand: 4, budgetRemaining: 200, spotsRemaining: 10,
  });
  assert.equal(priced[9].max_bid_suggested, 1, 'nobody has to be the one who overpays for depth');
  assert.equal(priced[9].above_demand_line, true);
});

test('the suggested bid is never allowed above the hard ceiling', () => {
  const players = Array.from({ length: 6 }, (_, i) => P('p' + i, 1));
  const priced = priceposition(players, {
    positionBudget: 5000, demand: 6, budgetRemaining: 20, spotsRemaining: 8,
  });
  const cap = hardMax({ budgetRemaining: 20, spotsRemaining: 8 });
  for (const p of priced) {
    assert.ok(p.max_bid_suggested <= cap, `suggested ${p.max_bid_suggested} exceeds the ceiling ${cap}`);
  }
});

// ---- demand ----------------------------------------------------------------

test('league demand counts starters, and sends flex where flex money goes', () => {
  const d = leagueDemand(DEFAULT_ROSTER, 12);
  assert.equal(d.QB, 12, '1 QB x 12 teams');
  assert.ok(d.RB > 24, 'flex must add to RB demand beyond the two starters');
  assert.ok(d.WR > 24);
});

test('a bigger league demands more of every position', () => {
  const small = leagueDemand(DEFAULT_ROSTER, 10);
  const big = leagueDemand(DEFAULT_ROSTER, 18);
  for (const pos of ['QB', 'RB', 'WR', 'TE']) assert.ok(big[pos] > small[pos]);
});

// ---- whole board -----------------------------------------------------------

test('taken players are removed and counted, never silently dropped', () => {
  const board = { positions: { RB: { players: [P('a', 1), P('b', 1), P('c', 2)] } } };
  const out = priceBoard(board, { teams: 12, budget: 200 }, { budgetRemaining: 100, spotsRemaining: 5 }, new Set(['b']));
  assert.equal(out.positions.RB.players.length, 2);
  assert.equal(out.positions.RB.taken_count, 1);
  assert.ok(!out.positions.RB.players.some((p) => p.id === 'b'));
});

test('no projected value is invented anywhere in pricing (ADR-0002)', () => {
  const board = { positions: { RB: { players: [P('a', 1)] } } };
  const [p] = priceBoard(board, { teams: 12, budget: 200 }, { budgetRemaining: 100, spotsRemaining: 5 }).positions.RB.players;
  for (const banned of ['points', 'projection', 'vorp', 'value_over_replacement', 'floor', 'ceiling']) {
    assert.ok(!(banned in p), `pricing must not introduce "${banned}"`);
  }
  assert.ok('max_bid_hard' in p && 'max_bid_suggested' in p, 'both figures must be present and distinct');
});
