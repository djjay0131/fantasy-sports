#!/usr/bin/env node
// print-draft.mjs — printable tiered cheat sheets for a keeper/snake draft,
// with every player already gone (keepers, and live picks if the draft has
// started) crossed off and tagged with the team that has him.
//
//   node scripts/print-draft.mjs --draft docs/data/foxwoods-draft.json
//   node scripts/print-draft.mjs --draft ... --live docs/data/draft-live.foxwoods.json --out docs/print/foxwoods-cheatsheet.pdf
//   node scripts/print-draft.mjs --draft ... --sections positions      # just the tiered position sheets
//                                          (--sections top,positions,card is the default)
//
// Pages: the ranker's overall top 200 (3 columns, round bands), then one tiered
// sheet per position, then a one-page draft card (roster, order, scoring in
// plain words). Rendered by headless Chrome on this machine; the output is
// git-ignored because it is derived from a paid subscriber source (ADR-0001).
// Same template as pdf.mjs (scripts/templates/print-board.html).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const arg = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const draftPath = arg('--draft');
if (!draftPath || !fs.existsSync(draftPath)) { console.error('usage: print-draft.mjs --draft docs/data/<league>-draft.json [--live ...] [--out ...]'); process.exit(2); }
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
const livePath = arg('--live', `docs/data/draft-live.${draft.league}.json`);
const live = fs.existsSync(livePath) ? JSON.parse(fs.readFileSync(livePath, 'utf8')) : null;
const board = JSON.parse(fs.readFileSync('docs/data/rankings.json', 'utf8'));
const top = fs.existsSync('docs/data/top200.json') ? JSON.parse(fs.readFileSync('docs/data/top200.json', 'utf8')) : null;
const outPdf = arg('--out', `docs/print/${draft.league}-cheatsheet.pdf`);
const pageSize = arg('--page', 'letter portrait');
const SECTIONS = new Set(arg('--sections', 'top,positions,card').split(',').map((x) => x.trim()));
const tpl = fs.readFileSync('scripts/templates/print-board.html', 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TIER_COLORS = [
  ['#1c6b52', '#e4efe9'], ['#2b4f86', '#e6ecf5'], ['#8a5a11', '#f6eddd'],
  ['#6b3d86', '#efe8f4'], ['#146b73', '#e2eff1'], ['#9b3d3d', '#f6e8e8'],
];

// Short tags for the team that owns a gone player, so the strike-through says who.
const short = (name) => {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words.length === 1 ? words[0].slice(0, 5) : words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
};
const teamTag = new Map(draft.order.map((t) => [t, short(t)]));

// gone: id -> { team, keeper, n }
const gone = new Map();
for (const s of draft.slots) if (s.keeper?.id) gone.set(s.keeper.id, { team: s.team, keeper: true, n: s.n });
let livePicks = 0;
for (const p of live?.picks || []) if (p.id && !gone.has(p.id)) { gone.set(p.id, { team: p.teamName || p.teamId, keeper: false, n: p.n }); livePicks++; }
const goneCell = (id) => { const g = gone.get(id); return g ? `<td class="gt">${esc(teamTag.get(g.team) || short(g.team))}${g.keeper ? '' : ' #' + g.n}</td>` : '<td class="gt"></td>'; };
const rowClass = (id) => { const g = gone.get(id); return g ? (g.team === draft.me ? 'gone me' : 'gone') : ''; };
const box = (id) => `<td class="box"><i>${gone.has(id) ? '✕' : ''}</i></td>`;

const captured = String(board.captured_at?.last || '').slice(0, 10);
const sub = `<span class="sub"><b>${esc(draft.name)}</b> · ${draft.teams} teams · ${esc(draft.scoring?.label?.split(',')[0] || '')}<br>${esc((board.sources || []).join(', '))} · captured ${captured} · ${gone.size} already gone</span>`;

function overallSheet() {
  if (!top) return '';
  const rounds = new Map();
  for (const p of top.players) { const r = Math.ceil(p.overall / draft.teams); if (!rounds.has(r)) rounds.set(r, []); rounds.get(r).push(p); }
  const blocks = [...rounds.entries()].map(([r, ps]) => {
    const [tc, tb] = TIER_COLORS[(r - 1) % TIER_COLORS.length];
    return `<div class="tier" style="--tc:${tc};--tb:${tb}">
      <div class="th"><span>ROUND ${r}</span><span class="n">#${(r - 1) * draft.teams + 1}–${r * draft.teams}</span></div>
      <table>${ps.map((p) => `<tr class="${rowClass(p.id)}">
        ${box(p.id)}
        <td class="rk">${p.overall}</td>
        <td><span class="nm">${esc(p.name)}</span> <span class="tm">${esc(p.team || '')}</span></td>
        <td class="by m">${p.bye ?? '–'}</td>
        <td class="sr">${esc(p.position || '')}${p.rank_position || ''}</td>
        <td class="tr">T${p.tier ?? '?'}</td>
        ${goneCell(p.id)}
      </tr>`).join('')}</table></div>`;
  }).join('');
  return `<section class="sheet"><header class="pg"><h1>Top ${top.players.length}</h1><span class="count">the ranker's own overall order</span>${sub}</header>
    <div class="cols">${blocks}
    <div class="legend"><b>Crossed off</b> = already on a roster (keepers), tagged with the team's initials; a pick number after the tag means drafted live.
      <b>Rows shaded blue</b> are ${esc(draft.me)}'s. <b>Right column</b> is the ranker's positional tier — when two players are close, take the one in the better tier, or the position you still need.
      Tick the box as each player goes. Rankings are ${esc((board.sources || []).join(', '))}'s, captured ${captured}; personal use only.</div></div></section>`;
}

function positionSheet(pos, blk) {
  const groups = new Map();
  for (const p of blk.players) { if (!groups.has(p.tier)) groups.set(p.tier, []); groups.get(p.tier).push(p); }
  const tiers = [...groups.entries()].map(([tier, ps]) => {
    const [tc, tb] = TIER_COLORS[(tier - 1) % TIER_COLORS.length];
    return `<div class="tier" style="--tc:${tc};--tb:${tb}">
      <div class="th"><span>TIER ${tier}</span><span class="n">${ps.length}</span></div>
      <table>${ps.map((p) => `<tr class="${rowClass(p.id)}">
        ${box(p.id)}
        <td class="rk">${esc(pos)}${p.rank_position}</td>
        <td><span class="nm">${esc(p.name)}</span> <span class="tm">${esc(p.team || '')}</span></td>
        <td class="by m">${p.bye ?? '–'}</td>
        ${goneCell(p.id)}
      </tr>`).join('')}</table></div>`;
  }).join('');
  const left = blk.players.filter((p) => !gone.has(p.id)).length;
  return `<section class="sheet"><header class="pg"><h1>${esc(pos)}</h1><span class="count">${blk.players.length} ranked · ${left} still available · ${groups.size} tiers</span>${sub}</header>
    <div class="cols">${tiers}
    <div class="legend"><b>Tiers:</b> ${blk.tier_source && blk.tier_source !== 'computed' ? `${esc(blk.tier_source)}'s own` : 'computed here (the source publishes none at this position)'}.
      Players inside one tier are close; the gap is between tiers. <b>Crossed off</b> = already gone (team initials; a pick number means drafted live). <b>Bye</b> is the week he does not play.</div></div></section>`;
}

function draftCard() {
  const L = draft.lineup || {};
  const starters = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DST'].filter((p) => L[p]).map((p) => `${L[p]} ${p}`).join(' · ');
  const mine = draft.slots.filter((s) => s.mine);
  const keepersByTeam = new Map(draft.order.map((t) => [t, []]));
  for (const s of draft.slots) if (s.keeper) keepersByTeam.get(s.team).push(`${s.keeper.name} (R${s.round})`);
  const whenLocal = draft.draft?.when ? new Date(draft.draft.when).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : '';
  return `<section class="sheet ref"><header class="pg"><h1>Draft card</h1><span class="sub"><b>${esc(draft.name)}</b> · ${esc(whenLocal)}<br>${draft.teams} teams · ${draft.rounds} rounds · snake · ${draft.draft?.clock_seconds || 90}s clock</span></header>
    <div class="two">
      <h2>Your lineup</h2>
      <p><b>Starters:</b> ${starters}. <b>Bench:</b> ${L.BENCH || 0}. FLEX can be a RB, WR or TE.</p>
      <p><b>The order to fill it:</b> RBs and WRs first (you start five of them), then a TE from a good tier, then a QB. Kicker and defense in the last two rounds — never earlier.</p>
      <h2>How to use the sheets</h2>
      <p>Cross off every name as it is called. When it is your turn, look at the <b>best tier still open</b> at the positions you need, and take the highest name in it. Do not reach into a worse tier for a position you already have.</p>
      <p>The strike-throughs already on the sheet are <b>keepers</b> — those players were on rosters before the draft started, so they will not be called.</p>
      <h2>Scoring, in plain words</h2>
      <p>${esc(draft.scoring?.label || '')}. A catch is worth half a point, so pass-catching backs and high-volume receivers matter; a passing touchdown is a full 6, so a top quarterback scores a lot — but there are more good quarterbacks than good running backs, so wait.</p>
      <h2>Draft order (round 1 — reverses each round)</h2>
      <p>${draft.order.map((t, i) => `<b>${i + 1}</b> ${esc(t)}`).join(' · ')}</p>
      <p><b>${esc(draft.me)}</b> picks at: ${mine.map((s) => s.keeper ? `<s>${s.n}</s>` : `<b>${s.n}</b>`).join(' · ')} (struck = used by a keeper).</p>
    </div>
    <h2>Keepers by team</h2>
    <div class="grid18" style="grid-template-columns:repeat(4,1fr)">
      ${draft.order.map((t) => `<div><b style="font:700 7.6pt -apple-system,Helvetica,Arial,sans-serif">${esc(t)}</b><br>${keepersByTeam.get(t).length ? keepersByTeam.get(t).map(esc).join('<br>') : '<i>none</i>'}</div>`).join('')}
    </div>
    <div class="legend">Rankings by ${esc((board.sources || []).join(', '))}, captured ${captured}. Keepers read from the league site ${esc(String(draft.generated_at || '').slice(0, 10))}${livePicks ? `; ${livePicks} live picks included` : ''}. Personal use — derived from a paid subscriber source, not for redistribution. Built ${new Date().toISOString().slice(0, 10)}.</div>
  </section>`;
}

const ORDER = ['RB', 'WR', 'QB', 'TE', 'K', 'DST'];
const sheets = [
  ...(SECTIONS.has('top') ? [overallSheet()] : []),
  ...(SECTIONS.has('positions') ? ORDER.filter((p) => board.positions[p]).map((p) => positionSheet(p, board.positions[p])) : []),
  ...(SECTIONS.has('card') ? [draftCard()] : []),
].join('\n');
const extraCss = `<style>
  tr.gone .nm { text-decoration: line-through; text-decoration-thickness: 1.2pt; color: #8a8a8a; font-weight: 500; }
  tr.gone td { color: #9a9a9a; }
  tr.gone .box i { border-color: #555; font: 700 6pt/6pt ui-monospace, Menlo, monospace; text-align: center; color: #333; }
  tr.gone.me td { background: #e6ecf5; }
  .tr { width: 14pt; text-align: right; font: 700 6.4pt ui-monospace, Menlo, monospace; color: #444; }
  td.sr { width: 22pt; }
  .gt { width: 24pt; text-align: right; font: 700 6.2pt ui-monospace, Menlo, monospace; color: #666; letter-spacing: 0.2pt; }
  .ref .two s { color: #999; }
  .cols td { white-space: nowrap; }
  .nm { font-size: 8pt; }
</style></head>`;
const html = tpl.replace('__TITLE__', esc(`${draft.name} cheat sheet`)).replace('__PAGESIZE__', pageSize).replace('</head>', extraCss).replace('__BODY__', sheets);

fs.mkdirSync(path.dirname(outPdf), { recursive: true });
const htmlPath = outPdf.replace(/\.pdf$/, '.html');
fs.writeFileSync(htmlPath, html);
const CANDIDATES = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', process.env.CHROME_PATH].filter(Boolean);
const chrome = CANDIDATES.find((c) => fs.existsSync(c));
if (!chrome) { console.error(`Wrote ${htmlPath}, but found no Chrome to print it with (Cmd-P → Save as PDF works).`); process.exit(1); }
if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);
const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', '--virtual-time-budget=4000', `--print-to-pdf=${path.resolve(outPdf)}`, `file://${path.resolve(htmlPath)}`], { encoding: 'utf8' });
if (!fs.existsSync(outPdf)) { console.error(r.stderr || r.stdout || 'Chrome produced no PDF.'); process.exit(1); }
console.log(`Wrote ${outPdf} (${(fs.statSync(outPdf).size / 1024).toFixed(0)} KB) — ${gone.size} crossed off (${gone.size - livePicks} keepers, ${livePicks} live picks)`);
