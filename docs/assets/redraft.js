/* redraft.js — snake-draft board on the ranker's tiers.
 *
 * This league drafts off tiers, not ADP, so ADP is not on this page. What is:
 *   - WHEN you pick next, and how many players go before then;
 *   - the ranker's tiers per position, and one cross-position view that
 *     interleaves them so "best tier left on the board" is visible at a glance;
 *   - what your roster still needs.
 *
 * The cross-position view is tier-first: every tier-1 player at every
 * position, then tier 2, and so on. Within a tier, positions are ordered by
 * how scarce a startable one is (RB, WR, TE, QB, K, DST), then by the ranker's
 * own rank. The ranker's export has no overall board; this is the closest
 * honest thing to one that uses only his numbers. Data is git-ignored.
 */
(function () {
  'use strict';
  const SRC = '../data/rankings.json', SAMPLE = '../data/rankings.sample.json', TOP = '../data/top200.json';
  let top = null; // the ranker's own overall board, when a capture exists
  const el = (id) => document.getElementById(id);
  const ui = { tabs: el('tabs'), list: el('list'), meta: el('meta'), search: el('search'), banner: el('banner'),
               teams: el('teams'), slot: el('slot'), picks: el('picks'), roster: el('roster'), hide: el('hide-taken') };

  // ESPN PPR Ins: 12 teams, 9 starters, 5 bench + 2 IR (read from league settings 2026-09-07).
  const LINEUP_DEFAULT = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 5 };
  let board = null, view = 'TIERS', query = '';
  let st = load();

  function load() {
    try { return Object.assign({ teams: 12, slot: 1, taken: [], mine: [], lineup: LINEUP_DEFAULT }, JSON.parse(localStorage.getItem('fs.redraft') || '{}')); }
    catch { return { teams: 12, slot: 1, taken: [], mine: [], lineup: LINEUP_DEFAULT }; }
  }
  function save() { try { localStorage.setItem('fs.redraft', JSON.stringify(st)); } catch {} }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function all() { return Object.entries(board.positions).flatMap(([pos, b]) => b.players.map((p) => ({ ...p, position: pos }))); }

  // ---- snake math -----------------------------------------------------------
  function myPicks(teams, slot, rounds = 20) {
    const out = [];
    for (let r = 1; r <= rounds; r++) out.push(r % 2 ? (r - 1) * teams + slot : r * teams - slot + 1);
    return out;
  }
  function currentPick() { return st.taken.length + 1; }
  function nextMyPick() { const cur = currentPick(); return myPicks(st.teams, st.slot).find((p) => p >= cur) ?? null; }

  function renderPicks() {
    const cur = currentPick(), next = nextMyPick(), picks = myPicks(st.teams, st.slot);
    const after = next ? picks.find((p) => p > next) : null;
    const gap = next ? next - cur : 0;
    ui.picks.innerHTML = `
      <div class="you-grid">
        <div><span class="k">On the clock</span><b>pick ${cur}</b><span class="muted"> · round ${Math.ceil(cur / st.teams)}</span></div>
        <div><span class="k">Your next</span><b>${next ? 'pick ' + next : '—'}</b>${next ? `<span class="muted"> · ${gap === 0 ? 'now' : gap + ' away'}</span>` : ''}</div>
        <div><span class="k">Then</span><b>${after ? 'pick ' + after : '—'}</b>${after && next ? `<span class="muted"> · ${after - next} between</span>` : ''}</div>
        <div><span class="k">Your slots</span><b class="mono-sm">${picks.slice(0, 8).join(' · ')}…</b></div>
      </div>`;
  }

  function renderRoster() {
    const byId = new Map(all().map((p) => [p.id, p]));
    const mine = st.mine.map((id) => byId.get(id)).filter(Boolean);
    const have = {};
    for (const p of mine) have[p.position] = (have[p.position] || 0) + 1;
    const L = st.lineup;
    const need = (pos) => Math.max(0, (L[pos] || 0) - (have[pos] || 0));
    const flexPool = ['RB', 'WR', 'TE'].reduce((a, p) => a + Math.max(0, (have[p] || 0) - (L[p] || 0)), 0);
    const flexNeed = Math.max(0, (L.FLEX || 0) - flexPool);
    const cells = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'].filter((p) => L[p]).map((p) =>
      `<span class="chip ${need(p) ? 'need' : ''}">${p} ${have[p] || 0}/${L[p]}</span>`);
    if (L.FLEX) cells.push(`<span class="chip ${flexNeed ? 'need' : ''}">FLEX ${Math.min(flexPool, L.FLEX)}/${L.FLEX}</span>`);
    ui.roster.innerHTML = `<div>${cells.join(' ')} <span class="muted" style="font-size:12px">· ${mine.length} drafted</span></div>` +
      (mine.length ? `<div style="margin-top:6px">${mine.map((p) => `<span class="chip">${esc(p.name)} <em>${p.position}${p.rank_position}</em></span>`).join(' ')}</div>` : '');
  }

  function renderMeta() {
    const f = board.format || {};
    ui.meta.innerHTML = [
      `<span><b>Format</b> ${esc(f.label || '')}</span>`,
      `<span><b>Ranker</b> ${esc((board.sources || []).join(', '))}</span>`,
      `<span><b>Captured</b> ${esc(String(board.captured_at?.last || '').slice(0, 10))}</span>`,
      `<span><b>Gone</b> ${st.taken.length}</span>`,
    ].join('');
  }

  const POS_ORDER = ['RB', 'WR', 'TE', 'QB', 'K', 'DST'];
  const posRank = (p) => { const i = POS_ORDER.indexOf(p); return i < 0 ? 99 : i; };

  function renderTabs() {
    const keys = [...(top ? ['TOP'] : []), 'TIERS', ...Object.keys(board.positions)];
    const label = (k) => k === 'TOP' ? `Jeff's ${top.players.length}` : k === 'TIERS' ? 'All tiers' : k;
    ui.tabs.innerHTML = keys.map((k) => `<button role="tab" data-v="${k}" aria-selected="${k === view}">${label(k)}</button>`).join('');
    ui.tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.v; renderTabs(); renderList(); }));
  }

  function row(p) {
    const taken = st.taken.includes(p.id), mine = st.mine.includes(p.id);
    return `<li data-id="${esc(p.id)}" data-clickable class="${mine ? 'is-mine' : taken ? 'drafted' : ''}">
      <span class="rk">${p.position}${p.rank_position}</span>
      <span class="nm">${esc(p.name)}<span class="tm"> ${esc(p.team || '')}${p.bye ? ' · bye ' + p.bye : ''}</span></span>
      <span class="sd" style="font:600 11px var(--mono);color:var(--ink-3)">T${p.tier}</span>
    </li>`;
  }

  function renderList() {
    const q = query.trim().toLowerCase();
    const filt = (p) => (!q || `${p.name} ${p.team || ''}`.toLowerCase().includes(q)) && !(ui.hide.checked && st.taken.includes(p.id));
    let html = '';
    if (view === 'TOP') {
      const mine = new Set(myPicks(st.teams, st.slot, 20));
      const list = top.players.filter(filt);
      const rounds = new Map();
      for (const p of list) { const r = Math.ceil(p.overall / st.teams); if (!rounds.has(r)) rounds.set(r, []); rounds.get(r).push(p); }
      html = [...rounds.entries()].map(([r, ps]) => `<div class="tier"><h3><span>Round ${r} <span class="n" style="text-transform:none;letter-spacing:0">· his #${(r - 1) * st.teams + 1}–${r * st.teams}</span></span><span class="n">${ps.length}</span></h3><ol>${ps.map((p) => {
        const taken = st.taken.includes(p.id), isMine = st.mine.includes(p.id);
        const yours = mine.has(p.overall);
        return `<li data-id="${esc(p.id)}" data-clickable class="${isMine ? 'is-mine' : taken ? 'drafted' : ''} ${yours ? 'yourslot' : ''}">
          <span class="rk">#${p.overall}</span>
          <span class="nm">${esc(p.name)}<span class="tm"> ${esc(p.team || '')} · ${p.position ? p.position + p.rank_position : '?'}${p.bye ? ' · bye ' + p.bye : ''}${yours ? ' · <b>your pick</b>' : ''}</span></span>
          <span class="sd" style="font:600 11px var(--mono);color:var(--ink-3)">${p.tier ? 'T' + p.tier : ''}</span>
        </li>`; }).join('')}</ol></div>`).join('')
        + `<div class="legend" style="grid-column:1/-1"><b>Jeff's own overall board</b>, captured ${esc(String(top.captured_at || '').slice(0, 10))}, grouped into rounds of ${st.teams} with his positional tier on every row. Rows marked <b>your pick</b> are where your slot falls <em>if the room drafted straight off his list</em> — it won't, but it tells you which tier you should be shopping in at each of your turns. <b>Click</b> = gone. <b>Shift-click</b> = yours.</div>`;
    } else if (view === 'TIERS') {
      const list = all().filter(filt).sort((a, b) => a.tier - b.tier || posRank(a.position) - posRank(b.position) || a.rank_position - b.rank_position);
      const groups = new Map();
      for (const p of list) { if (!groups.has(p.tier)) groups.set(p.tier, []); groups.get(p.tier).push(p); }
      html = [...groups.entries()].map(([t, ps]) => `<div class="tier"><h3><span>Tier ${t} — every position</span><span class="n">${ps.length}</span></h3><ol>${ps.map(row).join('')}</ol></div>`).join('')
        + `<div class="legend" style="grid-column:1/-1"><b>Tier-first, across positions.</b> Everyone the ranker put in tier 1, then tier 2, and so on — ordered within a tier by how scarce a startable one is (RB, WR, TE, QB), then by his rank. His export has no overall board; this uses only his tiers and ranks, nothing else. <b>Click</b> = gone. <b>Shift-click</b> = yours.</div>`;
    } else {
      const pos = board.positions[view];
      const groups = new Map();
      for (const p of pos.players.map((x) => ({ ...x, position: view })).filter(filt)) {
        if (!groups.has(p.tier)) groups.set(p.tier, []);
        groups.get(p.tier).push(p);
      }
      html = [...groups.entries()].map(([t, ps]) => `<div class="tier"><h3><span>Tier ${t}</span><span class="n">${ps.length}</span></h3><ol>${ps.map(row).join('')}</ol></div>`).join('')
        + `<div class="legend" style="grid-column:1/-1">${pos.tier_source && pos.tier_source !== 'computed' ? `<b>${esc(pos.tier_source)}'s own tiers.</b>` : '<b>Tiers computed here</b> — this source publishes none at this position.'} Right-hand column is the tier.</div>`;
    }
    ui.list.innerHTML = html;
    ui.list.querySelectorAll('li[data-clickable]').forEach((li) => li.addEventListener('click', (ev) => {
      const id = li.dataset.id;
      const t = new Set(st.taken), m = new Set(st.mine);
      if (ev.shiftKey) { if (m.has(id)) { m.delete(id); t.delete(id); } else { m.add(id); t.add(id); } }
      else if (t.has(id)) { t.delete(id); m.delete(id); } else t.add(id);
      st.taken = [...t]; st.mine = [...m]; save();
      renderPicks(); renderRoster(); renderMeta(); renderList();
    }));
  }

  async function init() {
    for (const [url, priv] of [[SRC, true], [SAMPLE, false]]) {
      try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) continue; board = await r.json(); board._private = priv; break; } catch {}
    }
    if (!board) { ui.list.innerHTML = '<div class="empty">No board data.</div>'; return; }
    try { const r = await fetch(TOP, { cache: 'no-store' }); if (r.ok) { top = await r.json(); view = 'TOP'; } } catch {}
    ui.banner.innerHTML = board._private
      ? `<div class="note"><strong>Local board.</strong> ${esc((board.sources || []).join(', '))} · captured ${esc(String(board.captured_at?.last || '').slice(0, 10))}. Set your league size and slot, then click players as they go.</div>`
      : `<div class="note"><strong>Sample board.</strong> ${esc(board.provenance || '')}</div>`;
    ui.teams.value = st.teams; ui.slot.value = st.slot;
    ui.teams.addEventListener('change', () => { st.teams = Math.max(2, +ui.teams.value || 12); save(); renderPicks(); renderList(); });
    ui.slot.addEventListener('change', () => { st.slot = Math.min(st.teams, Math.max(1, +ui.slot.value || 1)); ui.slot.value = st.slot; save(); renderPicks(); renderList(); });
    ui.search.addEventListener('input', (e) => { query = e.target.value; renderList(); });
    ui.hide.addEventListener('change', renderList);
    el('undo').addEventListener('click', () => { const last = st.taken.pop(); st.mine = st.mine.filter((x) => x !== last); save(); renderPicks(); renderRoster(); renderMeta(); renderList(); });
    el('reset').addEventListener('click', () => { st.taken = []; st.mine = []; save(); renderPicks(); renderRoster(); renderMeta(); renderList(); });
    renderPicks(); renderRoster(); renderMeta(); renderTabs(); renderList();
  }
  init();
})();
