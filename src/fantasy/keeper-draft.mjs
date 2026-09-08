// Snake-draft slot math for a keeper league: which overall pick each team
// owns, and which of those a keeper consumes. Pure; no I/O.

export function pickNumber(round, teamIndex, teams) {
  const pir = round % 2 ? teamIndex + 1 : teams - teamIndex;
  return (round - 1) * teams + pir;
}

// order: team names in round-1 order; keepers: [{team, round, ...}]
// Returns 180-style slots [{n, round, team, mine, keeper|null}].
export function buildSlots({ order, rounds, keepers = [], me = null }) {
  const teams = order.length;
  const keeperAt = new Map();
  for (const k of keepers) {
    const ti = order.indexOf(k.team);
    if (ti < 0) throw new Error(`keeper team not in order: ${k.team}`);
    const n = pickNumber(k.round, ti, teams);
    if (keeperAt.has(n)) throw new Error(`two keepers at pick ${n}`);
    keeperAt.set(n, k);
  }
  const slots = [];
  for (let n = 1; n <= teams * rounds; n++) {
    const round = Math.ceil(n / teams), pir = n - (round - 1) * teams;
    const team = order[round % 2 ? pir - 1 : teams - pir];
    slots.push({ n, round, team, mine: team === me, keeper: keeperAt.get(n) || null });
  }
  return slots;
}
