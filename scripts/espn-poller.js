// espn-poller.js — runs INSIDE a logged-in ESPN fantasy tab.
//
// Polls the league's draft detail every 12s using the browser's own session
// and POSTs the picks to the local board server, which resolves them against
// the ranker's board and writes docs/data/draft-live.json. Nothing here reads
// or copies a credential; the browser attaches its cookies as it would for
// any page fetch. Injected by scripts/draft-arm.sh via AppleScript.
(function () {
  if (window.__fsLive && window.__fsLive.timer) { clearInterval(window.__fsLive.timer); }
  var LEAGUE = 334829, SEASON = 2026, ME = 24;
  var API = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/' + SEASON + '/segments/0/leagues/' + LEAGUE;
  var POS = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST' };
  var TEAM = { 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU' };
  var S = window.__fsLive = { players: null, teams: {}, last: null, posts: 0, errors: 0, status: 'starting', timer: null };

  async function loadPlayers() {
    var r = await fetch(API.replace(/\/segments.*$/, '') + '/players?scoringPeriodId=0&view=players_wl', { credentials: 'include' });
    var j = await r.json();
    var m = {};
    j.forEach(function (p) { m[p.id] = { name: p.fullName, pos: POS[p.defaultPositionId] || String(p.defaultPositionId), team: TEAM[p.proTeamId] || null }; });
    S.players = m;
  }
  async function loadTeams() {
    var r = await fetch(API + '?view=mTeam', { credentials: 'include' });
    var j = await r.json();
    (j.teams || []).forEach(function (t) { S.teams[t.id] = t.name || ((t.location || '') + ' ' + (t.nickname || '')).trim(); });
  }
  async function tick() {
    try {
      S.status = 'loading players'; if (!S.players) await loadPlayers();
      S.status = 'loading teams'; if (!Object.keys(S.teams).length) await loadTeams();
      S.status = 'fetching draft';
      var r = await fetch(API + '?view=mDraftDetail', { credentials: 'include' });
      var j = await r.json();
      var dd = j.draftDetail || {};
      var picks = (dd.picks || []).filter(function (p) { return p.playerId && p.playerId > 0; }).map(function (p) {
        var pl = S.players[p.playerId] || {};
        return { n: p.overallPickNumber, round: p.roundId, teamId: p.teamId, teamName: S.teams[p.teamId] || null, playerId: p.playerId, name: pl.name || ('player ' + p.playerId), pos: pl.pos || null, team: pl.team || null };
      });
      var sig = picks.length + ':' + (picks.length ? picks[picks.length - 1].playerId : 0);
      // Chrome blocks a public page from POSTing to localhost, so the tab only
      // HOLDS the payload; scripts/draft-bridge.sh pulls it out via AppleScript
      // and posts it from the shell.
      S.payload = JSON.stringify({ picks: picks, me: ME, in_progress: !!dd.inProgress, sig: sig });
      S.last = sig;
      S.status = 'ok ' + picks.length + ' picks @ ' + new Date().toLocaleTimeString() + (dd.inProgress ? ' (in progress)' : '');
    } catch (e) { S.errors++; S.status = 'error: ' + e.message + ' @ ' + new Date().toLocaleTimeString(); }
  }
  tick();
  S.timer = setInterval(tick, 12000);
  return 'poller armed';
})();
