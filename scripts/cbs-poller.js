// cbs-poller.js — runs INSIDE a logged-in CBS fantasy league tab.
//
// CBS's "Draft Results" page fills in as the live draft goes, so every 12s
// this fetches it with the browser's own session, parses the rows, and holds
// the picks in window.__fsLive.payload for scripts/draft-bridge.sh to pull
// out and post to the local board server. No credential is read or copied;
// the browser attaches its cookies as it would for any page fetch.
(function () {
  if (window.__fsLive && window.__fsLive.timer) { clearInterval(window.__fsLive.timer); }
  var LEAGUE = 'foxwoods', ME = 'City Dwelling Etruscans', TEAMS = 12;
  var S = window.__fsLive = { last: null, errors: 0, status: 'starting', timer: null };

  async function tick() {
    try {
      S.status = 'fetching draft results';
      var r = await fetch('/draft/results', { credentials: 'include', cache: 'no-store' });
      var html = await r.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var table = Array.prototype.find.call(doc.querySelectorAll('table'), function (t) { return /Round 1/.test(t.textContent); });
      if (!table) throw new Error('no results table (logged out?)');
      var round = 0, picks = [], open = 0;
      Array.prototype.forEach.call(table.rows, function (tr) {
        var m = /^Round (\d+)/.exec(tr.textContent.trim());
        if (m) { round = +m[1]; return; }
        if (/^(subtitle|label)$/.test(tr.className) || tr.cells.length < 3) return;
        var pick = +tr.cells[0].textContent.trim(), team = tr.cells[1].textContent.trim();
        var a = tr.cells[2].querySelector('a.playerLink');
        if (!a) { open++; return; }
        var pt = (tr.cells[2].querySelector('.playerPositionAndTeam') || {}).textContent || '';
        var parts = pt.split('•').map(function (x) { return x.trim(); });
        picks.push({ n: (round - 1) * TEAMS + pick, round: round, teamId: team, teamName: team, name: a.textContent.trim(), pos: parts[0] || null, team: parts[1] || null, keeper: /\(Keeper\)/.test(tr.cells[2].textContent) });
      });
      picks.sort(function (a, b) { return a.n - b.n; });
      var sig = picks.length + ':' + (picks.length ? picks[picks.length - 1].n + picks[picks.length - 1].name : '');
      S.payload = JSON.stringify({ league: LEAGUE, picks: picks, me: ME, in_progress: open > 0, sig: sig });
      S.last = sig;
      S.status = 'ok ' + picks.length + ' picks (' + open + ' open) @ ' + new Date().toLocaleTimeString();
    } catch (e) { S.errors++; S.status = 'error: ' + e.message + ' @ ' + new Date().toLocaleTimeString(); }
  }
  tick();
  S.timer = setInterval(tick, 12000);
  return 'poller armed';
})();
