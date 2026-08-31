/* guillotine.js — the Guillotine draft board.
 *
 * Different game from a redraft board, so a different page: survival, not
 * season-long value. Three things this page does that the PPR board does not:
 *
 *   1. Shows the MOVE. Every row carries the ranker's original rank and how far
 *      the guillotine adjustment shifted it. The board shows its own work; a
 *      re-rank you cannot audit is just an assertion.
 *   2. Makes the bye week loud. In an 18-team league it is the single biggest
 *      format-specific risk, and it is invisible on a normal board.
 *   3. Tracks YOUR roster's byes as you draft. Stacking four starters on one
 *      bye is how people get chopped in Week 6 with a good team.
 *
 * Data is read at runtime and is git-ignored (ADR-0001).
 */
(function () {
  'use strict';

  const SRC = '../data/guillotine.json';
  const STARTERS = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 };

  const el = (id) => document.getElementById(id);
  const ui = {
    tabs: el('tabs'), tiers: el('tiers'), meta: el('meta'), search: el('search'),
    hide: el('hide-taken'), banner: el('banner'), roster: el('roster'), byegrid: el('byegrid'),
  };

  let board = null, position = null, query = '';
  let taken = load('fs.g.taken'), mine = load('fs.g.mine');

  function load(k) { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } }
  function save() {
    try {
      localStorage.setItem('fs.g.taken', JSON.stringify([...taken]));
      localStorage.setItem('fs.g.mine', JSON.stringify([...mine]));
    } catch { /* private window */ }
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Bye earliness is the whole point of this board, so it is colour-coded.
  function byeClass(bye) {
    if (bye == null) return '';
    const { first, last } = board.bye_range;
    const span = last - first || 1;
    const d = (last - bye) / span;
    return d > 0.66 ? 'bye-early' : d > 0.33 ? 'bye-mid' : 'bye-late';
  }

  function allPlayers() { return Object.values(board.positions).flatMap((p) => p.players); }

  function renderMeta() {
    ui.meta.innerHTML = [
      `<span><b>Format</b> ${esc(board.format.label)}</span>`,
      `<span><b>Ranker</b> ${esc((board.sources || []).join(', '))}</span>`,
      `<span><b>Captured</b> ${esc(String(board.captured_at?.last || '').slice(0, 10))}</span>`,
      `<span><b>Byes</b> weeks ${board.bye_range.first}–${board.bye_range.last}</span>`,
      board.flags_applied
        ? `<span><b>Risk flags</b> ${board.flags_applied}</span>`
        : `<span title="This pipeline has no injury feed and will not invent one. Add flags in data/processed/guillotine-flags.json."><b>Risk flags</b> none — check news yourself</span>`,
    ].join('');
  }

  function renderTabs() {
    ui.tabs.innerHTML = Object.keys(board.positions)
      .map((p) => `<button role="tab" data-pos="${esc(p)}" aria-selected="${p === position}">${esc(p)}</button>`).join('');
    ui.tabs.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => { position = b.dataset.pos; renderTabs(); renderTiers(); }));
  }

  function moveBadge(m) {
    if (!m) return '<span class="mv mv-0">–</span>';
    const cls = m > 0 ? 'mv-up' : 'mv-down';
    return `<span class="mv ${cls}" title="${Math.abs(m)} spot${Math.abs(m) === 1 ? '' : 's'} ${m > 0 ? 'higher' : 'lower'} than the ranker's own board">${m > 0 ? '▲' : '▼'}${Math.abs(m)}</span>`;
  }

  function renderTiers() {
    const pos = board.positions[position];
    if (!pos) { ui.tiers.innerHTML = '<div class="empty">Nothing at this position.</div>'; return; }
    const q = query.trim().toLowerCase();

    const groups = new Map();
    for (const p of pos.players) {
      if (q && !`${p.name} ${p.team || ''}`.toLowerCase().includes(q)) continue;
      if (ui.hide.checked && taken.has(p.id)) continue;
      if (!groups.has(p.tier)) groups.set(p.tier, []);
      groups.get(p.tier).push(p);
    }
    if (!groups.size) { ui.tiers.innerHTML = '<div class="empty">Nothing matches.</div>'; return; }

    ui.tiers.innerHTML = [...groups.entries()].map(([tier, players]) => `
      <div class="tier">
        <h3><span>Tier ${tier}</span><span class="n">${players.length}</span></h3>
        <ol>${players.map((p) => `
          <li data-id="${esc(p.id)}" data-clickable
              class="${mine.has(p.id) ? 'is-mine' : taken.has(p.id) ? 'drafted' : ''}">
            <span class="rk">${esc(position)}${p.rank_position}</span>
            <span class="nm">${esc(p.name)}<span class="tm"> ${esc(p.team || '')}${p.adp != null ? ` &middot; adp ${p.adp}` : ''}${p.flag_note ? ` &middot; <b>${esc(p.flag_note)}</b>` : ''}</span></span>
            <span class="bye ${byeClass(p.bye)}" title="bye week ${p.bye ?? '?'}">${p.bye ?? '–'}</span>
            <span class="src" title="the ranker had him ${esc(position)}${p.source_rank}">${esc(position)}${p.source_rank}</span>
            ${moveBadge(p.moved)}
          </li>`).join('')}
        </ol>
      </div>`).join('') + `
      <div class="legend" style="grid-column:1/-1">
        <b>Tiers are ${esc(pos.tier_basis)}.</b> The ranker decides how many players belong in a tier;
        the guillotine adjustment decides which ones. <b>Bye</b> is colour-coded by how hard that week is
        to cover — with ${board.league.teams} teams, roughly
        ${board.league.teams * 14} players are rostered on draft day, so an early bye is covered from an
        empty pool while a late one is covered from a dozen eliminated rosters.
        Bye weight at ${esc(position)} is <b>${pos.bye_weight} slots</b>.
        <b>▲▼</b> is the move against the ranker's own board.
        <br><b>Click</b> a player to mark him gone. <b>Shift-click</b> to mark him <em>yours</em>.
      </div>`;

    ui.tiers.querySelectorAll('li[data-clickable]').forEach((li) => {
      li.addEventListener('click', (ev) => {
        const id = li.dataset.id;
        if (ev.shiftKey) {
          if (mine.has(id)) { mine.delete(id); taken.delete(id); }
          else { mine.add(id); taken.add(id); }
        } else if (taken.has(id)) { taken.delete(id); mine.delete(id); }
        else taken.add(id);
        save(); renderTiers(); renderRoster();
      });
    });
  }

  function renderRoster() {
    const byId = new Map(allPlayers().map((p) => [p.id, p]));
    const squad = [...mine].map((id) => byId.get(id)).filter(Boolean);

    if (!squad.length) {
      ui.roster.innerHTML = `<p class="muted">Shift-click a player to add him to your roster. This panel
        then watches the thing that actually eliminates people: too many starters sharing one bye week.</p>`;
      ui.byegrid.innerHTML = '';
      return;
    }

    const byPos = {};
    for (const p of squad) (byPos[p.position] ||= []).push(p);
    ui.roster.innerHTML = Object.entries(byPos).map(([pos, ps]) => `
      <div class="rosterpos"><b>${esc(pos)}</b> <span class="muted">${ps.length}</span>
        <div>${ps.sort((a, b) => a.rank_position - b.rank_position)
          .map((p) => `<span class="chip">${esc(p.name)} <em class="${byeClass(p.bye)}">${p.bye ?? '?'}</em></span>`).join('')}</div>
      </div>`).join('');

    // The warning that matters: how many of these are startable bodies, per bye week.
    const { first, last } = board.bye_range;
    const weeks = [];
    for (let w = first; w <= last; w++) weeks.push(w);
    const counts = Object.fromEntries(weeks.map((w) => [w, squad.filter((p) => p.bye === w).length]));
    const startersNeeded = Object.values(STARTERS).reduce((a, b) => a + b, 0);
    const worst = Math.max(...Object.values(counts), 0);

    ui.byegrid.innerHTML = `
      <h3 class="byehead">Bye exposure <span class="muted">— players unavailable, by week</span></h3>
      <div class="byebar">
        ${weeks.map((w) => {
          const n = counts[w];
          const risk = n >= 4 ? 'hot' : n === 3 ? 'warm' : '';
          return `<div class="byecol ${risk}" title="${n} player${n === 1 ? '' : 's'} on bye week ${w}">
                    ${n ? `<span class="ct">${n}</span><div class="bar" style="height:${Math.min(100, n * 20)}%"></div>` : ''}
                    <span class="wk">${w}</span>
                  </div>`;
        }).join('')}
      </div>
      <p class="${worst >= 4 ? 'warn' : 'muted'}">
        ${worst >= 4
          ? `<b>Week ${weeks.find((w) => counts[w] === worst)} is a problem:</b> ${worst} of your ${squad.length} players are out,
             against ${startersNeeded} starting spots. In an ${board.league.teams}-team league that week is very hard to paper over.`
          : `Worst week costs you ${worst} player${worst === 1 ? '' : 's'} of ${squad.length}, against ${startersNeeded} starting spots.`}
      </p>`;
  }

  async function init() {
    try {
      const r = await fetch(SRC, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      board = await r.json();
    } catch {
      ui.tiers.innerHTML = `<div class="empty"><p>No guillotine board found.</p>
        <p style="font-size:14px">Build one with<br>
        <code>node scripts/refresh.mjs &amp;&amp; node scripts/guillotine.mjs --teams 18</code></p>
        <p style="font-size:13px" class="muted">On the published site this file is deliberately absent —
        it is derived from a paid subscriber source (<a href="../methodology.html#licence">why</a>).</p></div>`;
      return;
    }

    ui.banner.innerHTML = `<div class="note"><strong>Local board.</strong> ${esc(board.provenance)}</div>`;
    position = Object.keys(board.positions)[0];
    renderMeta(); renderTabs(); renderTiers(); renderRoster();

    ui.search.addEventListener('input', (e) => { query = e.target.value; renderTiers(); });
    ui.hide.addEventListener('change', renderTiers);
    el('reset').addEventListener('click', () => { taken = new Set(); mine = new Set(); save(); renderTiers(); renderRoster(); });
  }

  init();
})();
