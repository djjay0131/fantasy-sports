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
  // One script, two kinds of page. A plain redraft page configures nothing and
  // gets a teams/slot form. A keeper-league page sets data-draft on <body> to
  // a slot file from scripts/keeper-draft.mjs: keepers are pre-marked gone (or
  // yours), the picks they consume are skipped in the snake math, and the
  // draft order comes from the file rather than the form.
  const B = document.body.dataset;
  const KEY = B.key || 'fs.redraft', DRAFT = B.draft || null, LIVE = B.live || '../data/draft-live.json';
  const SRC = '../data/rankings.json', SAMPLE = '../data/rankings.sample.json', TOP = '../data/top200.json';
  let live = null; // picks pushed by the draft-room poller, when the draft is on
  let top = null; // the ranker's own overall board, when a capture exists
  let draft = null; // keeper-league slot file, when this page has one
  let keeperIds = new Set();
  const el = (id) => document.getElementById(id);
  const ui = { tabs: el('tabs'), list: el('list'), meta: el('meta'), search: el('search'), banner: el('banner'),
               teams: el('teams'), slot: el('slot'), picks: el('picks'), roster: el('roster'), hide: el('hide-taken') };

  // ESPN PPR Ins: 12 teams, 9 starters, 5 bench + 2 IR (read from league settings 2026-09-07).
  const LINEUP_DEFAULT = (() => { try { return JSON.parse(B.lineup); } catch { return null; } })() || { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 5 };
  let board = null, view = 'TIERS', query = '';
  let st = load();

  function load() {
    try { return Object.assign({ teams: 12, slot: 1, taken: [], mine: [], lineup: LINEUP_DEFAULT }, JSON.parse(localStorage.getItem(KEY) || '{}'), { lineup: LINEUP_DEFAULT }); }
    catch { return { teams: 12, slot: 1, taken: [], mine: [], lineup: LINEUP_DEFAULT }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function all() { return Object.entries(board.positions).flatMap(([pos, b]) => b.players.map((p) => ({ ...p, position: pos }))); }

  // ---- snake math -----------------------------------------------------------
  // "Open" slots are the picks that will actually be made in the room; with a
  // keeper file, the keeper-consumed slots are not open. Without one, every
  // slot is open and this is plain snake arithmetic.
  function openSlots() {
    if (draft) return draft.slots.filter((s) => !s.keeper);
    const out = [];
    for (let n = 1; n <= st.teams * 20; n++) {
      const r = Math.ceil(n / st.teams), pir = n - (r - 1) * st.teams;
      out.push({ n, round: r, mine: (r % 2 ? pir : st.teams - pir + 1) === st.slot });
    }
    return out;
  }
  function myPicks() { return openSlots().filter((s) => s.mine).map((s) => s.n); }
  function manualTaken() { return st.taken.filter((id) => !keeperIds.has(id)); }
  function currentPick() { const o = openSlots(); return o[manualTaken().length]?.n ?? (o.at(-1)?.n ?? 0) + 1; }
  // Where your pick lands on the ranker's list if the room drafted straight
  // off it: the k-th open slot before yours takes the k-th non-keeper player.
  function boardIndexOf(pick) { return openSlots().filter((s) => s.n < pick).length; }

  async function pollLive() {
    try {
      const r = await fetch(LIVE, { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      const changed = !live || data.updated !== live.updated;
      live = data;
      if (!changed) return;
      const t = new Set(st.taken), m = new Set(st.mine);
      for (const p of data.picks || []) {
        if (!p.id) continue;
        t.add(p.id);
        if (p.mine) m.add(p.id);
      }
      st.taken = [...t]; st.mine = [...m]; save();
      renderPicks(); renderRoster(); renderMeta(); renderList(); renderLive();
    } catch { /* no live file yet */ }
  }

  function renderLive() {
    const el2 = el('live');
    if (!el2) return;
    if (!live || !live.picks?.length) { el2.innerHTML = live ? '<span class="livepill">LIVE · waiting for pick 1</span>' : ''; return; }
    const last = live.picks.at(-1);
    const age = Math.round((Date.now() - new Date(live.updated).getTime()) / 1000);
    const stale = age > 90;
    el2.innerHTML = `<span class="livepill ${stale ? 'stale' : ''}">${stale ? 'STALE ' + age + 's' : 'LIVE'}</span>
      <span class="muted">last: #${last.n} ${esc(last.name)} <em>${esc(last.board || last.pos || '')}</em>${last.mine ? ' — <b>you</b>' : last.teamName ? ' — ' + esc(last.teamName) : ''}</span>
      ${live.unresolved ? `<span class="muted"> · ${live.unresolved} not matched to the board</span>` : ''}`;
  }
  function nextMyPick() { const cur = currentPick(); return myPicks().find((p) => p >= cur) ?? null; }

  function renderPicks() {
    const cur = currentPick(), next = nextMyPick(), picks = myPicks();
    const after = next ? picks.find((p) => p > next) : null;
    const between = (a, b) => openSlots().filter((s) => s.n >= a && s.n < b).length; // picks actually made in the room
    const gap = next ? between(cur, next) : 0;
    ui.picks.innerHTML = `
      <div class="you-grid">
        <div><span class="k">On the clock</span><b>pick ${cur}</b><span class="muted"> · round ${Math.ceil(cur / st.teams)}</span></div>
        <div><span class="k">Your next</span><b>${next ? 'pick ' + next : '—'}</b>${next ? `<span class="muted"> · ${gap === 0 ? 'now' : gap + ' away'}</span>` : ''}</div>
        <div><span class="k">Then</span><b>${after ? 'pick ' + after : '—'}</b>${after && next ? `<span class="muted"> · ${between(next + 1, after)} between</span>` : ''}</div>
        <div><span class="k">Your ${draft ? 'open picks' : 'slots'}</span><b class="mono-sm">${picks.slice(0, draft ? 12 : 8).join(' · ')}${picks.length > (draft ? 12 : 8) ? '…' : ''}</b></div>
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
      (mine.length ? `<div style="margin-top:6px">${mine.map((p) => `<span class="chip">${esc(p.name)} <em>${p.position}${p.rank_position}${keeperIds.has(p.id) ? ' · keeper' : ''}</em></span>`).join(' ')}</div>` : '');
  }

  function renderMeta() {
    const f = board.format || {};
    ui.meta.innerHTML = [
      `<span><b>Format</b> ${esc(f.label || '')}</span>`,
      `<span><b>Ranker</b> ${esc((board.sources || []).join(', '))}</span>`,
      `<span><b>Captured</b> ${esc(String(board.captured_at?.last || '').slice(0, 10))}</span>`,
      `<span><b>Gone</b> ${st.taken.length}${draft ? ` <span class="muted">(${draft.keepers} keepers + ${manualTaken().length} picks)</span>` : ''}</span>`,
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
      // Mark the row your pick would reach if the room drafted off his list,
      // skipping keepers (they are off the board before pick 1).
      const pool = top.players.filter((p) => !keeperIds.has(p.id));
      const marker = new Map(); // player id -> your pick number
      for (const pk of myPicks()) { const p = pool[boardIndexOf(pk)]; if (p && !marker.has(p.id)) marker.set(p.id, pk); }
      const list = top.players.filter(filt);
      const rounds = new Map();
      for (const p of list) { const r = Math.ceil(p.overall / st.teams); if (!rounds.has(r)) rounds.set(r, []); rounds.get(r).push(p); }
      html = [...rounds.entries()].map(([r, ps]) => `<div class="tier"><h3><span>Round ${r} <span class="n" style="text-transform:none;letter-spacing:0">· his #${(r - 1) * st.teams + 1}–${r * st.teams}</span></span><span class="n">${ps.length}</span></h3><ol>${ps.map((p) => {
        const taken = st.taken.includes(p.id), isMine = st.mine.includes(p.id);
        const yours = marker.has(p.id);
        return `<li data-id="${esc(p.id)}" data-clickable class="${isMine ? 'is-mine' : taken ? 'drafted' : ''} ${yours ? 'yourslot' : ''}">
          <span class="rk">#${p.overall}</span>
          <span class="nm">${esc(p.name)}<span class="tm"> ${esc(p.team || '')} · ${p.position ? p.position + p.rank_position : '?'}${p.bye ? ' · bye ' + p.bye : ''}${yours ? ` · <b>your pick ${marker.get(p.id)}</b>` : ''}${keeperIds.has(p.id) ? ' · keeper' : ''}</span></span>
          <span class="sd" style="font:600 11px var(--mono);color:var(--ink-3)">${p.tier ? 'T' + p.tier : ''}</span>
        </li>`; }).join('')}</ol></div>`).join('')
        + `<div class="legend" style="grid-column:1/-1"><b>Jeff's own overall board</b>, captured ${esc(String(top.captured_at || '').slice(0, 10))}, grouped into rounds of ${st.teams} with his positional tier on every row. Rows marked <b>your pick</b> are where your slot falls <em>if the room drafted straight off his list</em>${draft ? ' (keepers skipped — they are gone before pick 1, and the picks they consume are not made)' : ''} — it won't, but it tells you which tier you should be shopping in at each of your turns. <b>Click</b> = gone. <b>Shift-click</b> = yours.</div>`;
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
    if (DRAFT) {
      try { const r = await fetch(DRAFT, { cache: 'no-store' }); if (r.ok) draft = await r.json(); } catch {}
      if (draft) {
        keeperIds = new Set(draft.slots.filter((s) => s.keeper?.id).map((s) => s.keeper.id));
        const t = new Set(st.taken), m = new Set(st.mine);
        for (const s of draft.slots) if (s.keeper?.id) { t.add(s.keeper.id); if (s.mine) m.add(s.keeper.id); }
        st.taken = [...t]; st.mine = [...m]; st.teams = draft.teams; st.slot = draft.order.indexOf(draft.me) + 1; save();
        ui.teams.disabled = ui.slot.disabled = true;
        if (draft.unresolved?.length) console.warn('keepers not on the board:', draft.unresolved);
      }
    }
    ui.banner.innerHTML = board._private
      ? `<div class="note"><strong>Local board.</strong> ${esc((board.sources || []).join(', '))} · captured ${esc(String(board.captured_at?.last || '').slice(0, 10))}. ${draft ? `<b>${esc(draft.name)}</b> · ${draft.teams} teams, ${draft.rounds} rounds, you are <b>${esc(draft.me)}</b> (slot ${draft.order.indexOf(draft.me) + 1}) · ${draft.keepers} keepers pre-marked${draft.unresolved?.length ? ` · <span style="color:var(--warn)">${draft.unresolved.length} keeper(s) not on the board</span>` : ''} · scoring: ${esc(draft.scoring?.label || '')}` : 'Set your league size and slot, then click players as they go.'}</div>`
      : `<div class="note"><strong>Sample board.</strong> ${esc(board.provenance || '')}</div>`;
    ui.teams.value = st.teams; ui.slot.value = st.slot;
    ui.teams.addEventListener('change', () => { st.teams = Math.max(2, +ui.teams.value || 12); save(); renderPicks(); renderList(); });
    ui.slot.addEventListener('change', () => { st.slot = Math.min(st.teams, Math.max(1, +ui.slot.value || 1)); ui.slot.value = st.slot; save(); renderPicks(); renderList(); });
    ui.search.addEventListener('input', (e) => { query = e.target.value; renderList(); });
    ui.hide.addEventListener('change', renderList);
    el('undo').addEventListener('click', () => { const i = st.taken.map((id) => keeperIds.has(id)).lastIndexOf(false); if (i < 0) return; const [last] = st.taken.splice(i, 1); st.mine = st.mine.filter((x) => x !== last); save(); renderPicks(); renderRoster(); renderMeta(); renderList(); });
    el('reset').addEventListener('click', () => { st.taken = st.taken.filter((id) => keeperIds.has(id)); st.mine = st.mine.filter((id) => keeperIds.has(id)); save(); renderPicks(); renderRoster(); renderMeta(); renderList(); });
    renderPicks(); renderRoster(); renderMeta(); renderTabs(); renderList();
    pollLive(); setInterval(pollLive, 12000);
  }
  init();
})();
