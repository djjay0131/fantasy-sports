/* redraft.js — snake-draft board.
 *
 * What a snake draft actually needs that a ranking does not:
 *   - WHEN you pick next, and how many players go before then;
 *   - which of the players you like will survive to that pick (ADP), and
 *     which you must take now or lose;
 *   - what your roster still needs.
 *
 * Jeff's positional tiers are the value order. ADP is the room's order. The
 * "By ADP" view lays the room's order out with Jeff's tier on every row and a
 * line where your next pick falls: above it is probably gone, below it is
 * probably there. Data is git-ignored (ADR-0001).
 */
(function () {
  'use strict';
  const SRC = '../data/rankings.json', SAMPLE = '../data/rankings.sample.json';
  const el = (id) => document.getElementById(id);
  const ui = { tabs: el('tabs'), list: el('list'), meta: el('meta'), search: el('search'), banner: el('banner'),
               teams: el('teams'), slot: el('slot'), picks: el('picks'), roster: el('roster'), hide: el('hide-taken') };

  const LINEUP_DEFAULT = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 7 };
  let board = null, view = 'ADP', query = '';
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

  function hasAdp() { return all().some((p) => p.adp != null); }

  function renderTabs() {
    const keys = [...(hasAdp() ? ['ADP'] : []), ...Object.keys(board.positions)];
    ui.tabs.innerHTML = keys.map((k) => `<button role="tab" data-v="${k}" aria-selected="${k === view}">${k === 'ADP' ? 'By ADP' : k}</button>`).join('');
    ui.tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.v; renderTabs(); renderList(); }));
  }

  function row(p) {
    const taken = st.taken.includes(p.id), mine = st.mine.includes(p.id);
    const v = p.vs_adp;
    const vcls = v == null || v === 0 ? '' : v >= 8 ? 'risk-lo' : v <= -8 ? 'risk-hi' : 'risk-mid';
    return `<li data-id="${esc(p.id)}" data-clickable class="${mine ? 'is-mine' : taken ? 'drafted' : ''}">
      <span class="rk">${p.adp != null && view === 'ADP' ? p.adp : p.position + p.rank_position}</span>
      <span class="nm">${esc(p.name)}<span class="tm"> ${esc(p.team || '')} · ${view === 'ADP' ? p.position + p.rank_position + ' · ' : ''}T${p.tier}${p.bye ? ' · bye ' + p.bye : ''}</span></span>
      <span class="sd ${vcls}" title="rank vs ADP">${v ? (v > 0 ? '+' : '') + v : ''}</span>
    </li>`;
  }

  function renderList() {
    const q = query.trim().toLowerCase();
    const filt = (p) => (!q || `${p.name} ${p.team || ''}`.toLowerCase().includes(q)) && !(ui.hide.checked && st.taken.includes(p.id));
    let html = '';
    if (view === 'ADP') {
      const list = all().filter((p) => p.adp != null).sort((a, b) => a.adp - b.adp).filter(filt);
      const next = nextMyPick(), after = next ? myPicks(st.teams, st.slot).find((p) => p > next) : null;
      let marked = false, marked2 = false, out = '';
      for (const p of list) {
        if (!marked && next && p.adp >= next) { out += `<li class="pickline"><span>▼ your next pick — #${next}</span></li>`; marked = true; }
        if (!marked2 && after && p.adp >= after) { out += `<li class="pickline soft"><span>▼ the one after — #${after}</span></li>`; marked2 = true; }
        out += row(p);
      }
      html = `<div class="tier tier-wide"><h3><span>The room's order (ADP) with Jeff's tier</span><span class="n">${list.length}</span></h3><ol>${out}</ol></div>
        <div class="legend" style="grid-column:1/-1">Above the line is probably gone before you pick again; below it will probably be there. The right-hand number is Jeff's rank vs ADP — <b>+</b> means he likes the player more than the room does, so you can wait; <b>−</b> means the room will take him before Jeff would. <b>Click</b> = drafted by someone. <b>Shift-click</b> = yours.</div>`;
    } else {
      const pos = board.positions[view];
      const groups = new Map();
      for (const p of pos.players.map((x) => ({ ...x, position: view })).filter(filt)) {
        if (!groups.has(p.tier)) groups.set(p.tier, []);
        groups.get(p.tier).push(p);
      }
      html = [...groups.entries()].map(([t, ps]) => `<div class="tier"><h3><span>Tier ${t}</span><span class="n">${ps.length}</span></h3><ol>${ps.map(row).join('')}</ol></div>`).join('')
        + `<div class="legend" style="grid-column:1/-1">${pos.tier_source && pos.tier_source !== 'computed' ? `<b>${esc(pos.tier_source)}'s own tiers.</b>` : '<b>Tiers computed here</b> — this source publishes none at this position.'} Right-hand number is rank vs ADP.</div>`;
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
    if (!hasAdp()) view = Object.keys(board.positions)[0];
    renderPicks(); renderRoster(); renderMeta(); renderTabs(); renderList();
  }
  init();
})();
