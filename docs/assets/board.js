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

  const PRIVATE = '../data/rankings.json';
  const SAMPLE = '../data/rankings.sample.json';

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

  // Right-hand column. With several sources it shows the spread (how much
  // they disagree). With one it shows how far that source sits from the
  // draft room's ADP — positive is a value, negative is a fade.
  function signal(p) {
    if (p.sources > 1) {
      const cls = p.sd < 1.5 ? 'risk-lo' : p.sd < 4 ? 'risk-mid' : 'risk-hi';
      return { cls, text: '\u00b1' + Number(p.sd).toFixed(1), title: 'spread across sources' };
    }
    if (p.vs_adp == null || p.vs_adp === 0) return { cls: '', text: '', title: '' };
    const v = p.vs_adp;
    const cls = v >= 8 ? 'risk-lo' : v <= -8 ? 'risk-hi' : 'risk-mid';
    return {
      cls,
      text: (v > 0 ? '+' : '') + v,
      title: `ranked ${Math.abs(v)} spot${Math.abs(v) === 1 ? '' : 's'} ${v > 0 ? 'higher than' : 'lower than'} ADP (overall ADP ${p.adp ?? '\u2014'})`,
    };
  }

  function renderMeta() {
    const f = board.format || {};
    const cap = board.captured_at?.last;
    const authored = Object.entries(board.positions || {})
      .filter(([, p]) => p.tier_source && p.tier_source !== 'computed' && p.tier_source !== 'human override')
      .map(([k]) => k);
    const bits = [
      `<span><b>Format</b> ${esc(f.label || f.id || 'unspecified')}</span>`,
      `<span><b>Sources</b> ${esc((board.sources || []).join(', ') || 'none')}</span>`,
      authored.length
        ? `<span><b>Tiers</b> ${esc(authored.join('/'))} by the ranker, the rest computed</span>`
        : `<span><b>Tiers</b> computed</span>`,
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
    const authored = pos.tier_source && pos.tier_source !== 'computed' && pos.tier_source !== 'human override';

    el.tiers.innerHTML = [...groups.entries()].map(([tier, players]) => `
      <div class="tier">
        <h3><span>Tier ${tier}</span><span class="n">${players.length} player${players.length === 1 ? '' : 's'}</span></h3>
        <ol>${players.map((p) => `
          <li data-id="${esc(p.id)}" data-clickable class="${drafted.has(p.id) ? 'drafted' : ''}">
            <span class="rk">${esc(position)}${p.rank_position}</span>
            <span class="nm">${esc(p.name)}<span class="tm">  ${esc(p.team || '')}${p.bye ? ` &middot; bye ${p.bye}` : ''}${p.adp != null ? ` &middot; adp ${p.adp}` : ''}</span></span>
            <span class="sd ${signal(p).cls}" title="${esc(signal(p).title)}">${esc(signal(p).text)}</span>
          </li>`).join('')}
        </ol>
      </div>`).join('') +
      `<div class="legend" style="grid-column:1/-1">
         ${authored
           ? `<b>These are ${esc(pos.tier_source)}&rsquo;s own tiers</b>, carried through unchanged &mdash;
              the ranker is the expert and this board does not second-guess their tiering${override}.`
           : `<b>Tiers computed here</b> from ${esc(pos.method || 'the rank distribution')}, threshold
              ${esc(pos.threshold)}${override}. This source publishes no tiers at this position, so these
              breaks are ours, not theirs.`}
         ${board.sources && board.sources.length > 1
           ? `<b>&plusmn;</b> is the spread across sources: wide disagreement <em>keeps</em> players in one
              tier rather than splitting them.`
           : `The right-hand number is rank <b>vs. ADP</b> &mdash; positive means this source rates the
              player above where the draft room takes him.`}
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

  // ---- live refresh -------------------------------------------------------
  // The board is a file on disk, so "live" means: notice when the refresher
  // has rewritten it, and re-render without losing what the drafter has
  // already marked off. Polling is cheap (one conditional GET) and needs no
  // server, which keeps the page a static artifact.
  const POLL_MS = 45000;
  let pollTimer = null;

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (document.hidden) return;
      const next = await fetchBoard();
      if (!next || next.generated_at === board.generated_at) return;
      const keepPosition = position;
      board = next;
      if (board.positions?.[keepPosition]) position = keepPosition;
      else position = Object.keys(board.positions || {})[0] || null;
      renderBanner(); renderMeta(); renderTabs(); renderTiers();
      flashUpdated();
    }, POLL_MS);
  }

  function flashUpdated() {
    const t = document.getElementById('updated');
    if (!t) return;
    t.textContent = `updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    t.hidden = false;
    clearTimeout(flashUpdated._t);
    flashUpdated._t = setTimeout(() => { t.hidden = true; }, 8000);
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
    startPolling();
  }

  init();
})();
