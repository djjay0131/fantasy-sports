/* board.js — renders a tiered positional board from a JSON dataset.
 *
 * ADR-0001: this page reads its data at runtime. On the published site
 * data/rankings.json is absent (it is git-ignored) and the page falls back
 * to the committed sample. Run the same site locally with your own
 * rankings.json in place and it renders your real board. Same code, both
 * cases — that is what makes the licence split enforceable rather than
 * aspirational.
 */
(function () {
  'use strict';

  const PRIVATE = 'data/rankings.json';
  const SAMPLE = 'data/rankings.sample.json';

  const el = {
    tabs: document.getElementById('tabs'),
    tiers: document.getElementById('tiers'),
    meta: document.getElementById('meta'),
    search: document.getElementById('search'),
    hideDrafted: document.getElementById('hide-drafted'),
    banner: document.getElementById('banner'),
  };

  let board = null;
  let position = null;
  let query = '';
  let drafted = load();

  function load() {
    try { return new Set(JSON.parse(localStorage.getItem('fs.drafted') || '[]')); }
    catch { return new Set(); }
  }
  function save() {
    try { localStorage.setItem('fs.drafted', JSON.stringify([...drafted])); } catch { /* private mode */ }
  }

  async function fetchBoard() {
    for (const [url, isPrivate] of [[PRIVATE, true], [SAMPLE, false]]) {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) continue;
        const data = await r.json();
        data._private = isPrivate;
        data._url = url;
        return data;
      } catch { /* try the next one */ }
    }
    return null;
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function riskClass(sd, sources) {
    if (!sources || sources < 2) return '';
    if (sd < 1.5) return 'risk-lo';
    if (sd < 4) return 'risk-mid';
    return 'risk-hi';
  }

  function renderMeta() {
    const f = board.format || {};
    const cap = board.captured_at?.last;
    const bits = [
      `<span><b>Format</b> ${esc(f.label || f.id || 'unspecified')}</span>`,
      `<span><b>Sources</b> ${esc((board.sources || []).join(', ') || 'none')}</span>`,
      cap ? `<span><b>Captured</b> ${esc(String(cap).slice(0, 10))}</span>` : '',
      board.generated_at ? `<span><b>Built</b> ${esc(board.generated_at.slice(0, 10))}</span>` : '',
    ];
    el.meta.innerHTML = bits.filter(Boolean).join('');
  }

  function renderTabs() {
    const positions = Object.keys(board.positions || {});
    el.tabs.innerHTML = positions
      .map((p) => `<button role="tab" data-pos="${esc(p)}" aria-selected="${p === position}">${esc(p)}</button>`)
      .join('');
    el.tabs.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => { position = b.dataset.pos; renderTabs(); renderTiers(); });
    });
  }

  function renderTiers() {
    const pos = board.positions?.[position];
    if (!pos) { el.tiers.innerHTML = '<div class="empty">No players at this position.</div>'; return; }

    const q = query.trim().toLowerCase();
    const groups = new Map();
    for (const p of pos.players) {
      if (q && !(`${p.name} ${p.team || ''}`.toLowerCase().includes(q))) continue;
      if (el.hideDrafted.checked && drafted.has(p.id)) continue;
      if (!groups.has(p.tier)) groups.set(p.tier, []);
      groups.get(p.tier).push(p);
    }
    if (!groups.size) { el.tiers.innerHTML = '<div class="empty">Nothing matches.</div>'; return; }

    const override = pos.accepted_breaks
      ? ` &middot; human override applied${pos.override_note ? `: ${esc(pos.override_note)}` : ''}`
      : '';

    el.tiers.innerHTML = [...groups.entries()].map(([tier, players]) => `
      <div class="tier">
        <h3><span>Tier ${tier}</span><span class="n">${players.length} player${players.length === 1 ? '' : 's'}</span></h3>
        <ol>${players.map((p) => `
          <li data-id="${esc(p.id)}" data-clickable class="${drafted.has(p.id) ? 'drafted' : ''}">
            <span class="rk">${esc(position)}${p.rank_position}</span>
            <span class="nm">${esc(p.name)}<span class="tm">  ${esc(p.team || '')}${p.bye ? ` &middot; bye ${p.bye}` : ''}</span></span>
            <span class="sd ${riskClass(p.sd, p.sources)}">${p.sources > 1 ? `&plusmn;${Number(p.sd).toFixed(1)}` : ''}</span>
          </li>`).join('')}
        </ol>
      </div>`).join('') +
      `<div class="legend" style="grid-column:1/-1">
         <b>Tiers</b> are computed from ${esc(pos.method || 'the rank distribution')}, threshold
         ${esc(pos.threshold)}${override}. <b>&plusmn;</b> is the spread across sources — a wide spread
         means the sources disagree, which <em>keeps</em> players in one tier rather than splitting them.
         Click a player to mark them drafted.
       </div>`;

    el.tiers.querySelectorAll('li[data-clickable]').forEach((li) => {
      li.addEventListener('click', () => {
        const id = li.dataset.id;
        drafted.has(id) ? drafted.delete(id) : drafted.add(id);
        save();
        renderTiers();
      });
    });
  }

  function renderBanner() {
    if (board._private) {
      el.banner.innerHTML = `<div class="note"><strong>Local board.</strong> Rendering
        <code>${esc(board._url)}</code> &mdash; your own data, on your machine. This file is
        git-ignored and never reaches the public repository (ADR-0001).</div>`;
    } else {
      el.banner.innerHTML = `<div class="note"><strong>This is the sample board.</strong>
        ${esc(board.provenance || '')} It is here to show what the tool does, not to be drafted from.
        The maintainer&rsquo;s real board is built from a paid subscriber source and is
        <em>deliberately absent</em> from this public site &mdash;
        <a href="../methodology.html#licence">why</a>.</div>`;
    }
  }

  async function init() {
    board = await fetchBoard();
    if (!board) {
      el.tiers.innerHTML = `<div class="empty"><p>No board data found.</p>
        <p style="font-size:14px">Generate one with<br>
        <code>node scripts/tier.mjs --in data/processed/rows.json --out docs/data/rankings.json</code></p></div>`;
      return;
    }
    position = Object.keys(board.positions || {})[0] || null;
    renderBanner(); renderMeta(); renderTabs(); renderTiers();

    el.search.addEventListener('input', (e) => { query = e.target.value; renderTiers(); });
    el.hideDrafted.addEventListener('change', renderTiers);
    document.getElementById('clear-drafted').addEventListener('click', () => {
      drafted = new Set(); save(); renderTiers();
    });
  }

  init();
})();
