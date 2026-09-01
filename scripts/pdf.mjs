#!/usr/bin/env node
// pdf.mjs — print the Guillotine board to a PDF you can take to the table.
//
//   node scripts/pdf.mjs                       # from docs/data/guillotine.json
//   node scripts/pdf.mjs --in docs/data/guillotine.sample.json --out data/print/sample.pdf
//
// Rendered by headless Chrome ON THIS MACHINE. The board is derived from a
// paid subscriber source (ADR-0001), so it is built where the data already
// lives and written to the git-ignored data/print/ — never to docs/, which is
// published.
//
// HTML + CSS rather than a PDF drawing library: the tier colour bands, the
// three-column flow and the widow control are all things CSS paging does well
// and hand-placed coordinates do badly. The data is inlined into a
// self-contained HTML file first, so the render needs no server and no
// network, and the .html is a usable artifact in its own right.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const arg = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const inPath = arg('--in', 'docs/data/guillotine.json');
// docs/print/ is served by the local board server, so the sheet is reachable
// from any device on the tailnet — and it is git-ignored, so it never reaches
// the published site (ADR-0001).
const outPdf = arg('--out', 'docs/print/guillotine-cheatsheet.pdf');
const pageSize = arg('--page', 'letter portrait');
const tplPath = 'scripts/templates/print-board.html';

if (!fs.existsSync(inPath)) {
  console.error(`No board at ${inPath}.\nBuild one first:\n  node scripts/refresh.mjs && node scripts/guillotine.mjs --teams 18`);
  process.exit(2);
}

const board = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const tpl = fs.readFileSync(tplPath, 'utf8');

// Six tints that stay legible under black text and survive a mono printer as
// distinguishable greys. Cycled, so tier 7 looks like tier 1 again — the band
// separates neighbours, it does not encode an absolute level.
const TIER_COLORS = [
  ['#1c6b52', '#e4efe9'], ['#2b4f86', '#e6ecf5'], ['#8a5a11', '#f6eddd'],
  ['#6b3d86', '#efe8f4'], ['#146b73', '#e2eff1'], ['#9b3d3d', '#f6e8e8'],
];

// The scoring format, without the team count the source label bakes in.
function scoringLabel() {
  const l = board.scoring_format?.label || board.format?.label || '';
  return l.split(' / ').filter((part) => !/\bteam\b/i.test(part)).join(' / ') || 'unspecified scoring';
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function byeClass(bye) {
  if (bye == null) return 'm';
  const { first, last } = board.bye_range;
  const span = (last - first) || 1;
  const d = (last - bye) / span;
  return d > 0.66 ? 'e' : d > 0.33 ? 'm' : 'l';
}

function mv(m) {
  if (!m) return '<td class="mv z">·</td>';
  return `<td class="mv ${m > 0 ? 'u' : 'd'}">${m > 0 ? '+' : ''}${m}</td>`;
}

function positionSheet(pos, block) {
  const groups = new Map();
  for (const p of block.players) {
    if (!groups.has(p.tier)) groups.set(p.tier, []);
    groups.get(p.tier).push(p);
  }
  const tiers = [...groups.entries()].map(([tier, players]) => {
    const [tc, tb] = TIER_COLORS[(tier - 1) % TIER_COLORS.length];
    return `<div class="tier" style="--tc:${tc};--tb:${tb}">
      <div class="th"><span>TIER ${tier}</span><span class="n">${players.length}</span></div>
      <table>${players.map((p) => `<tr>
        <td class="box"><i></i></td>
        <td class="rk">${esc(pos)}${p.rank_position}</td>
        <td><span class="nm">${esc(p.name)}</span> <span class="tm">${esc(p.team || '')}</span></td>
        <td class="by ${byeClass(p.bye)}">${p.bye ?? '–'}</td>
        <td class="sr">${esc(pos)}${p.source_rank}</td>
        ${mv(p.moved)}
      </tr>`).join('')}</table>
    </div>`;
  }).join('');

  const authored = block.tier_basis && !block.tier_basis.startsWith('computed');
  return `<section class="sheet">
    <header class="pg">
      <h1>${esc(pos)}</h1>
      <span class="count">${block.players.length} deep · ${groups.size} tiers</span>
      <span class="sub"><b>${esc(board.league.teams)}-team guillotine</b> · ${esc(scoringLabel())}<br>
        ${esc((board.sources || []).join(', '))} · captured ${esc(String(board.captured_at?.last || '').slice(0, 10))}</span>
    </header>
    <div class="cols">${tiers}
      <div class="legend">
        <b>Tiers:</b> ${esc(block.tier_basis)}. &nbsp;
        <b>Bye:</b> shaded by how hard the week is to cover — dark = late and easy, amber = early and hard.
        Bye weight at ${esc(pos)} is ${block.bye_weight} slots. &nbsp;
        <b>Right two columns:</b> the ranker's own rank, then the move against it.
        Rankings are his; the shifts are bye-week cover difficulty for an ${esc(board.league.teams)}-team league.
        <b>Not modelled:</b> injury, snap counts, schedule. Check the news before you call a name.
      </div>
    </div>
  </section>`;
}

function referenceSheet() {
  const all = Object.values(board.positions).flatMap((p) => p.players);
  const teamBye = new Map();
  for (const p of all) if (p.team && p.bye) teamBye.set(p.team, p.bye);
  const byWeek = new Map();
  for (const [t, w] of teamBye) { if (!byWeek.has(w)) byWeek.set(w, []); byWeek.get(w).push(t); }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);

  return `<section class="sheet ref">
    <header class="pg"><h1>Draft card</h1>
      <span class="sub"><b>${esc(board.league.teams)}-team guillotine</b><br>1QB / 2RB / 2WR / 1TE / 2FLEX + 6 bench</span>
    </header>
    <div class="two">
      <h2>The format changes four things</h2>
      <p><b>Score early or die early.</b> Lowest score each week is chopped; the roster hits FAAB waivers. No
        playoffs — a Week 10 breakout is worth nothing if you went out in Week 3. Draft the best Week 1 lineup.</p>
      <p><b>Nothing speculative.</b> No injured stashes, no snap-count ramps, no suspensions. Consistent
        scorers beat higher-variance upside: you are avoiding a floor, not chasing a ceiling.</p>
      <p><b>Byes are the killer.</b> ~${board.league.teams * 14} players are rostered on draft day, so an early
        bye is covered from an empty pool. By Week 13 a dozen eliminated rosters have come back. That is
        what the board's shift encodes — and why the bye column is shaded.</p>
      <p><b>RBs first.</b> Far fewer RBs than WRs post a usable week, and ${board.league.teams} teams drains
        the pool. Two RBs before a second WR is defensible here. Handcuff your own — a lost starter is not
        replaceable off waivers.</p>
      <h2>FAAB</h2>
      <p>Hold <b>70–75%</b> for the real difference-makers falling off eliminated rosters; <b>25–30%</b> for
        weekly patching. Get aggressive late, when few teams are left and every week is close to a coin flip.</p>
      <h2>At the table</h2>
      <p>Tick the box as each player goes. Watch your own bye column as you build — four starters sharing one
        week is how a good roster gets chopped in Week 6.</p>
    </div>
    <h2>Bye weeks — do not stack these</h2>
    <div class="grid18">
      ${weeks.map((w) => `<div><b>WK ${w}</b><br>${byWeek.get(w).sort().join(' · ')}</div>`).join('')}
    </div>
    <div class="legend">
      Rankings by ${esc((board.sources || []).join(', '))}, captured
      ${esc(String(board.captured_at?.last || '').slice(0, 10))}. Ordering shifts and tier membership are this
      project's; tier sizes are the ranker's. Personal use — derived from a paid subscriber source and not for
      redistribution. Built ${new Date().toISOString().slice(0, 10)}.
    </div>
  </section>`;
}

const ORDER = ['RB', 'WR', 'QB', 'TE', 'K', 'DST'];
const sheets = ORDER.filter((p) => board.positions[p])
  .map((p) => positionSheet(p, board.positions[p])).join('\n') + '\n' + referenceSheet();

const html = tpl
  .replace('__TITLE__', esc(`${board.league.teams}-team guillotine cheat sheet`))
  .replace('__PAGESIZE__', pageSize)
  .replace('__BODY__', sheets);

fs.mkdirSync(path.dirname(outPdf), { recursive: true });
const htmlPath = outPdf.replace(/\.pdf$/, '.html');
fs.writeFileSync(htmlPath, html);

// Find a Chrome that can print. Any Chromium-family binary will do.
const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  process.env.CHROME_PATH,
].filter(Boolean);
const chrome = CANDIDATES.find((c) => fs.existsSync(c));
if (!chrome) {
  console.error(`Wrote ${htmlPath}, but found no Chrome to print it with.`);
  console.error(`Open it and use Cmd-P -> Save as PDF, or set CHROME_PATH.`);
  process.exit(1);
}

const r = spawnSync(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
  '--virtual-time-budget=4000',
  `--print-to-pdf=${path.resolve(outPdf)}`,
  `file://${path.resolve(htmlPath)}`,
], { encoding: 'utf8' });

if (!fs.existsSync(outPdf)) {
  console.error(r.stderr || r.stdout || 'Chrome produced no PDF.');
  console.error(`The HTML is at ${htmlPath} — Cmd-P from a browser also works.`);
  process.exit(1);
}

const kb = (fs.statSync(outPdf).size / 1024).toFixed(0);
console.log(`Wrote ${outPdf} (${kb} KB)`);
console.log(`  pages   : ${(sheets.match(/class="sheet\b/g) || []).length} sheets (a long position may run to two)`);
console.log(`  source  : ${inPath}`);
console.log(`  html    : ${htmlPath}`);
