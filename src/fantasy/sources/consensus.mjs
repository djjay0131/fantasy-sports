// consensus.mjs — a freely available consensus ranking export.
//
// This is the connector behind the public sample dataset (ADR-0001). It
// accepts either JSON rows or a CSV with a header row containing at least
// rank, player, team, position.

export function parse(raw, { format, capturedAt } = {}) {
  const text = raw.trim();
  if (text.startsWith('[') || text.startsWith('{')) return fromJson(JSON.parse(text));
  return fromCsv(text);
}

function fromJson(data) {
  const list = Array.isArray(data) ? data : data.players || [];
  const players = [];
  const rejections = [];
  const counters = {};
  for (const r of list) {
    const position = up(r.position ?? r.pos);
    const name = r.name ?? r.player;
    if (!name || !position) {
      rejections.push({ name: name ?? null, reason: 'missing name or position' });
      continue;
    }
    counters[position] = (counters[position] || 0) + 1;
    players.push({
      name: String(name).trim(),
      team: r.team ? up(r.team) : null,
      position,
      bye: r.bye ?? null,
      rank_overall: num(r.rank_overall ?? r.overall ?? r.rank),
      rank_position: num(r.rank_position ?? r.pos_rank) ?? counters[position],
    });
  }
  return { players, rejections };
}

function fromCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const head = splitCsv(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (...names) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iRank = col('rank', 'overall', 'rk', 'ovr');
  const iName = col('player', 'name', 'player name');
  const iTeam = col('team', 'tm');
  const iPos = col('position', 'pos');
  const iBye = col('bye', 'bye week');
  const iPosRank = col('pos rank', 'position rank', 'pos_rank');

  const players = [];
  const rejections = [];
  const counters = {};

  for (const line of lines.slice(1)) {
    const c = splitCsv(line);
    const name = iName >= 0 ? c[iName]?.trim() : null;
    let position = iPos >= 0 ? up(c[iPos]) : null;
    let posRank = iPosRank >= 0 ? num(c[iPosRank]) : null;

    // Many exports encode position and positional rank in one cell: "RB1".
    if (position && /^[A-Z]+\d+$/.test(position)) {
      posRank = posRank ?? num(position.replace(/\D/g, ''));
      position = position.replace(/\d/g, '');
    }
    if (!name || !position) {
      rejections.push({ name: name ?? null, reason: `unparseable row: ${line.slice(0, 80)}` });
      continue;
    }
    counters[position] = (counters[position] || 0) + 1;
    players.push({
      name,
      team: iTeam >= 0 && c[iTeam] ? up(c[iTeam]) : null,
      position,
      bye: iBye >= 0 ? num(c[iBye]) : null,
      rank_overall: iRank >= 0 ? num(c[iRank]) : null,
      rank_position: posRank ?? counters[position],
    });
  }
  return { players, rejections };
}

function splitCsv(line) {
  const out = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.replace(/^"|"$/g, ''));
}

const up = (s) => (s == null ? null : String(s).trim().toUpperCase());
const num = (s) => {
  const n = Number(String(s ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
