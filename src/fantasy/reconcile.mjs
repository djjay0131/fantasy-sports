// Reconcile rows from several sources into one consensus board per format.
//
// Aggregation is by mean rank, with each source's own rank and the spread
// retained so disagreement stays visible rather than being averaged away
// (design doc §Reconcile). Source weighting is deliberately absent: weights
// need history to justify them, and guessing them is worse than not
// weighting at all (backlog, phase 3).

export function reconcile(rows) {
  const byKey = new Map(); // `${position}|${id}` -> accumulator

  for (const r of rows) {
    const key = `${r.position}|${r.player.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: r.player.id,
        name: r.player.name,
        team: r.player.team,
        position: r.position,
        bye: r.player.bye ?? null,
        ranks: {},
      });
    }
    byKey.get(key).ranks[r.source] = r.rank_position;
  }

  const out = [];
  for (const p of byKey.values()) {
    const vals = Object.values(p.ranks);
    const n = vals.length;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
    out.push({
      ...p,
      mean: Number(mean.toFixed(3)),
      sd: Number(Math.sqrt(variance).toFixed(3)),
      sources: n,
      min: Math.min(...vals),
      max: Math.max(...vals),
    });
  }
  return out;
}

export function groupByPosition(players) {
  const g = new Map();
  for (const p of players) {
    if (!g.has(p.position)) g.set(p.position, []);
    g.get(p.position).push(p);
  }
  return g;
}
