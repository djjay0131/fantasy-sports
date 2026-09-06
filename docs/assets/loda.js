/* loda.js — the L-O-D-A auction board.
 *
 * Two dollar figures per player, kept apart on purpose:
 *   HARD  — arithmetic. Your budget minus a dollar per other open spot. Bid
 *           over it and you cannot fill your roster. Same for everyone.
 *   SUGG  — policy. A share of the money actually left in the room, spread
 *           across the ranker's tiers. Argue with it; it is not a projection.
 *
 * "Overall" orders every position by suggested dollars, because in an auction
 * the cross-position ordering IS the dollar ordering. Data is git-ignored.
 */
(function () {
  'use strict';
  const SRC = '../data/loda.json';
  const el = (id) => document.getElementById(id);
  const ui = { tabs: el('tabs'), tiers: el('tiers'), meta: el('meta'), search: el('search'),
               banner: el('banner'), you: el('you'), scen: el('scenarios') };
  let board = null, view = 'ALL', query = '';
  let gone = load();

  function load() { try { return new Set(JSON.parse(localStorage.getItem('fs.loda.gone') || '[]')); } catch { return new Set(); } }
  function save() { try { localStorage.setItem('fs.loda.gone', JSON.stringify([...gone])); } catch {} }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (n) => '$' + n;

  function renderYou() {
    const y = board.you, m = board.market;
    ui.you.innerHTML = `
      <div class="you-grid">
        <div><span class="k">You</span><b>${esc(y.team)}</b></div>
        <div><span class="k">Left</span><b>${$(y.budgetRemaining)}</b></div>
        <div><span class="k">Spots</span><b>${y.spotsRemaining}</b></div>
        <div><span class="k">Hard max</span><b class="hard">${$(y.hard_max)}</b></div>
        <div><span class="k">Room</span><b>${$(m.money_remaining)} / ${m.spots_remaining} spots</b></div>
        <div><span class="k">Per spot</span><b>${$(m.per_spot)}</b></div>
      </div>`;
    if (y.keeper_match && y.scenarios?.length) {
      ui.scen.innerHTML = `
        <h3 class="byehead">If you match on ${esc(y.keeper_match.player)} at…</h3>
        <table class="scen"><tr><th>match price</th><th>left</th><th>spots</th><th>per spot</th><th>new hard max</th></tr>
        ${y.scenarios.map((s) => `<tr><td>${$(s.price)}</td><td>${$(s.left)}</td><td>${s.spots}</td><td>${$(s.per_spot)}</td><td class="hard">${$(s.hard_max)}</td></tr>`).join('')}
        </table>
        <p class="muted" style="font-size:12.5px;margin:6px 0 0">The room knows you'll match, so expect him to be bid up. Every dollar he costs comes off every other bid you make tonight.</p>`;
    }
  }

  function renderMeta() {
    const m = board.market;
    ui.meta.innerHTML = [
      `<span><b>Ranker</b> ${esc(board.sources.join(', '))}</span>`,
      `<span><b>Captured</b> ${esc(String(board.captured_at?.last || '').slice(0, 10))}</span>`,
      `<span><b>Off the board</b> ${board.taken} rostered or kept</span>`,
      `<span><b>IDP</b> ~${m.idp_spots_est} spots, ~${$(m.idp_reserve_est)} — <em>not ranked here</em></span>`,
    ].join('');
  }

  function renderTabs() {
    const keys = ['ALL', ...Object.keys(board.positions)];
    ui.tabs.innerHTML = keys.map((k) => `<button role="tab" data-v="${k}" aria-selected="${k === view}">${k === 'ALL' ? 'Top ' + board.overall.length : k}</button>`).join('');
    ui.tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.v; renderTabs(); renderList(); }));
  }

  function row(p, showPos) {
    const hard = board.you.hard_max;
    const cls = gone.has(p.id) ? 'drafted' : '';
    const rk = showPos ? `${p.position}${p.rank_position}` : `${p.position}${p.rank_position}`;
    return `<li data-id="${esc(p.id)}" data-clickable class="${cls}">
      <span class="rk">${p.overall ? '#' + p.overall : rk}</span>
      <span class="nm">${esc(p.name)}<span class="tm"> ${esc(p.team || '')} · ${p.overall ? rk + ' · ' : ''}T${p.tier}${p.bye ? ' · bye ' + p.bye : ''}</span></span>
      <span class="sugg ${p.above_demand_line ? 'dim' : ''}" title="suggested — a policy allocation of the room's remaining money across the ranker's tiers">${$(p.max_bid_suggested)}</span>
      <span class="hardc" title="hard max — the most you can bid and still fill your roster">${$(Math.min(hard, p.max_bid_hard))}</span>
    </li>`;
  }

  function renderList() {
    const q = query.trim().toLowerCase();
    let html = '';
    if (view === 'ALL') {
      const list = board.overall.filter((p) => !q || `${p.name} ${p.team}`.toLowerCase().includes(q));
      html = `<div class="tier tier-wide"><h3><span>Overall by suggested $</span><span class="n">${list.length}</span></h3><ol>${list.map((p) => row(p, true)).join('')}</ol></div>`;
    } else {
      const pos = board.positions[view];
      const groups = new Map();
      for (const p of pos.players) {
        if (q && !`${p.name} ${p.team || ''}`.toLowerCase().includes(q)) continue;
        if (!groups.has(p.tier)) groups.set(p.tier, []);
        groups.get(p.tier).push({ ...p, position: view });
      }
      html = [...groups.entries()].map(([t, ps]) => `<div class="tier"><h3><span>Tier ${t}</span><span class="n">${ps.length}</span></h3><ol>${ps.map((p) => row(p, false)).join('')}</ol></div>`).join('')
        + `<div class="legend" style="grid-column:1/-1"><b>${view}</b>: ${pos.players.length} left, ${pos.taken_count} rostered or kept. Pool ~${$(pos.position_budget)} for ~${pos.demand} starter slots leaguewide; past that line everyone prices at $1.</div>`;
    }
    ui.tiers.innerHTML = html + `<div class="legend" style="grid-column:1/-1"><b>Left $</b> is suggested — policy, not a projection. <b>Right $</b> is your hard max right now; it drops as you spend. Click a player when he's sold.</div>`;
    ui.tiers.querySelectorAll('li[data-clickable]').forEach((li) => li.addEventListener('click', () => {
      const id = li.dataset.id; gone.has(id) ? gone.delete(id) : gone.add(id); save(); renderList();
    }));
  }

  async function init() {
    try { const r = await fetch(SRC, { cache: 'no-store' }); if (!r.ok) throw 0; board = await r.json(); }
    catch { ui.tiers.innerHTML = `<div class="empty"><p>No L-O-D-A board found.</p><p style="font-size:14px"><code>node scripts/loda.mjs</code></p><p class="muted" style="font-size:13px">Absent on the published site by design (<a href="../methodology.html#licence">why</a>).</p></div>`; return; }
    ui.banner.innerHTML = `<div class="note"><strong>${esc(board.league_name)} — local board.</strong> ${esc(board.provenance)}</div>`;
    renderYou(); renderMeta(); renderTabs(); renderList();
    ui.search.addEventListener('input', (e) => { query = e.target.value; renderList(); });
    el('reset').addEventListener('click', () => { gone = new Set(); save(); renderList(); });
  }
  init();
})();
