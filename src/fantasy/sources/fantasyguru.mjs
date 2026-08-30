// fantasyguru.mjs — Jeff Mans' rankings, exported from fantasyguru.com.
//
// The export is an HTML <table> served with a .xls extension (Excel's
// "HTML spreadsheet" format), or the same table inside a real .xlsx. Both
// carry the same seven columns:
//
//   Rank | Tier | Player | Team | Bye | ADP | SOS
//
// Two facts about this source shape the connector:
//
// 1. **Mans publishes his own tiers.** He is the expert; his tiers are the
//    product. So they are carried through as authoritative and the local
//    tiering algorithm does NOT overwrite them (llm/specs/... §Tier).
//    K and DST carry no tier in the source; those are computed locally and
//    labelled as such, so the board never presents a computed tier as the
//    author's.
//
// 2. **The single-table export has no position column.** It stacks the
//    positions back to back and restarts Rank at 1 for each, so position is
//    carried by block ORDER alone. Guessing that order is how a board ends
//    up silently mislabelling 120 receivers, so this connector detects the
//    blocks by rank reset, verifies each one, and REJECTS rather than
//    guesses when the shape does not match (Principle 5).
//
// Rankings, not projections (ADR-0002): ADP is itself a rank and is kept as
// context; SOS is a 2-10 schedule rating, kept as metadata. No projected
// point total exists in this export, and none is ever synthesized.

const DEFAULT_BLOCK_ORDER = ['DST', 'K', 'QB', 'RB', 'TE', 'WR'];

const NFL_TEAMS = new Set([
  'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU',
  'IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI',
  'PIT','SEA','SF','TB','TEN','WAS',
]);

// A DST row's "player" is the franchise, e.g. "Houston Texans".
const DST_SUFFIX = /\b(Cardinals|Falcons|Ravens|Bills|Panthers|Bears|Bengals|Browns|Cowboys|Broncos|Lions|Packers|Texans|Colts|Jaguars|Chiefs|Chargers|Rams|Raiders|Dolphins|Vikings|Patriots|Saints|Giants|Jets|Eagles|Steelers|Seahawks|49ers|Buccaneers|Titans|Commanders)$/;

export function parse(raw, { format, capturedAt, blockOrder = DEFAULT_BLOCK_ORDER } = {}) {
  const table = extractRows(raw);
  if (!table.length) {
    return { players: [], rejections: [{ reason: 'no <table> rows found in capture' }] };
  }

  const header = table[0].map((c) => c.trim().toLowerCase());
  const col = (...names) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const iRank = col('rank', 'overall');
  const iTier = col('tier');
  const iName = col('player', 'name');
  const iTeam = col('team', 'tm');
  const iBye = col('bye');
  const iAdp = col('adp');
  const iSos = col('sos');
  const iPos = col('pos', 'position'); // present in the FLEX / Top-200 exports

  if (iRank < 0 || iName < 0) {
    return { players: [], rejections: [{ reason: `unexpected header: ${header.join('|')}` }] };
  }

  const body = table.slice(1).filter((r) => r.some((c) => c && c.trim()));
  const rejections = [];

  // --- split into blocks wherever Rank restarts at 1 -----------------------
  const blocks = [];
  let cur = null;
  for (const r of body) {
    const rank = num(r[iRank]);
    if (rank === null) { rejections.push({ name: r[iName] ?? null, reason: `unparseable rank "${r[iRank]}"` }); continue; }
    if (rank === 1 || cur === null) { cur = []; blocks.push(cur); }
    cur.push({ rank, row: r });
  }

  // --- name each block -----------------------------------------------------
  let labels;
  if (iPos >= 0) {
    labels = null; // the export names the position per row; blocks are irrelevant
  } else if (blocks.length === 1) {
    return { players: [], rejections: [{ reason: 'single block with no position column — cannot determine positions; use a per-position export' }] };
  } else {
    labels = nameBlocks(blocks, blockOrder, iName, rejections);
    if (!labels) return { players: [], rejections };
  }

  // --- emit rows -----------------------------------------------------------
  const players = [];
  const perPos = {};
  const emit = (r, rank, position) => {
    const name = (r[iName] ?? '').trim();
    if (!name || !position) {
      rejections.push({ name: name || null, reason: 'missing name or position' });
      return;
    }
    perPos[position] = (perPos[position] || 0) + 1;
    const tier = iTier >= 0 ? num(r[iTier]) : null;
    players.push({
      name,
      team: iTeam >= 0 ? up(r[iTeam]) : null,
      position,
      bye: iBye >= 0 ? num(r[iBye]) : null,
      rank_position: iPos >= 0 ? perPos[position] : rank,
      rank_overall: iPos >= 0 ? rank : null,
      // The author's own tier. Null where the source publishes none.
      source_tier: tier,
      adp: iAdp >= 0 ? num(r[iAdp]) : null,
      sos: iSos >= 0 ? num(r[iSos]) : null,
    });
  };

  if (iPos >= 0) {
    for (const b of blocks) for (const { rank, row } of b) emit(row, rank, up(row[iPos]));
  } else {
    blocks.forEach((b, i) => { for (const { rank, row } of b) emit(row, rank, labels[i]); });
  }

  return { players, rejections };
}

// Assign a position to each block. The declared order is a hypothesis, not a
// fact: it is checked against what the rows actually look like, and a
// mismatch is a rejection rather than a silent mislabel.
function nameBlocks(blocks, order, iName, rejections) {
  const dstIdx = blocks.findIndex((b) => b.every(({ row }) => DST_SUFFIX.test((row[iName] || '').trim())));

  if (blocks.length !== order.length) {
    rejections.push({
      reason:
        `capture has ${blocks.length} position blocks but the declared order names ${order.length} ` +
        `(${order.join(', ')}). The export layout changed — re-declare blockOrder rather than guessing.`,
    });
    return null;
  }
  if (dstIdx >= 0 && order[dstIdx] !== 'DST') {
    rejections.push({
      reason:
        `block ${dstIdx + 1} contains NFL franchises (so it is DST) but the declared order calls it ` +
        `"${order[dstIdx]}". Refusing to label ${blocks[dstIdx].length} rows from a wrong hypothesis.`,
    });
    return null;
  }
  if (dstIdx < 0 && order.includes('DST')) {
    rejections.push({ reason: 'declared order includes DST but no block of NFL franchises was found' });
    return null;
  }
  return order;
}

// --- table extraction -------------------------------------------------------
// Both export flavours are HTML. Kept dependency-free on purpose: this parses
// a known-shape table, not arbitrary HTML.
function extractRows(html) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
  let m;
  while ((m = trRe.exec(html))) {
    const cells = [];
    let c;
    cellRe.lastIndex = 0;
    while ((c = cellRe.exec(m[1]))) cells.push(decode(strip(c[1])));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

const strip = (s) => s.replace(/<[^>]*>/g, '');
const decode = (s) =>
  s.replace(/&nbsp;/g, ' ')
   .replace(/&amp;/g, '&')
   .replace(/&lt;/g, '<')
   .replace(/&gt;/g, '>')
   .replace(/&quot;/g, '"')
   .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
   .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
   .trim();

const up = (s) => (s == null || s === '' ? null : String(s).trim().toUpperCase());
const num = (s) => {
  if (s == null || String(s).trim() === '') return null;
  const n = Number(String(s).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export { NFL_TEAMS, DEFAULT_BLOCK_ORDER };
