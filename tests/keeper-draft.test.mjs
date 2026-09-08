import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlots, pickNumber } from '../src/fantasy/keeper-draft.mjs';

const order = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);

test('snake: slot 12 owns 12, 13, 36, 37, ... 180 over 15 rounds', () => {
  const slots = buildSlots({ order, rounds: 15, me: 'T12' });
  assert.equal(slots.length, 180);
  assert.deepEqual(slots.filter((s) => s.mine).map((s) => s.n), [12, 13, 36, 37, 60, 61, 84, 85, 108, 109, 132, 133, 156, 157, 180]);
  assert.equal(pickNumber(2, 0, 12), 24); // slot 1 picks last in round 2
});

test('a keeper consumes the owner\'s pick in that round', () => {
  const slots = buildSlots({ order, rounds: 15, me: 'T12', keepers: [{ team: 'T12', round: 5, name: 'X' }, { team: 'T1', round: 2, name: 'Y' }] });
  assert.equal(slots[59].keeper.name, 'X'); // pick 60
  assert.equal(slots[23].keeper.name, 'Y'); // pick 24
  assert.equal(slots.filter((s) => s.mine && !s.keeper).length, 14);
});

test('refuses a keeper for a team not in the order, or two at one pick', () => {
  assert.throws(() => buildSlots({ order, rounds: 15, keepers: [{ team: 'nobody', round: 1 }] }));
  assert.throws(() => buildSlots({ order, rounds: 15, keepers: [{ team: 'T1', round: 1 }, { team: 'T1', round: 1 }] }));
});
