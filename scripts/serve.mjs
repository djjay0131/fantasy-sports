#!/usr/bin/env node
// serve.mjs — static server for docs/ plus one write endpoint for the live draft.
//
//   node scripts/serve.mjs [--port 8722]
//
// GET  /...                 static files under docs/
// POST /api/draft-live      {picks:[{n,round,teamId,playerId,name,pos,team}], me:<teamId>, league?}
//                           -> resolves names against the board, writes
//                              docs/data/draft-live[.<league>].json (git-ignored, ADR-0001)
//
// The poster is a small loop injected into a logged-in league tab (ESPN, CBS); it uses the
// browser's own session, so no credential is ever copied out of the browser.
// CORS is open only because the caller is a page on another origin (ESPN)
// talking to this machine; the endpoint writes one derived file and nothing
// else, and it only listens on the interfaces you expose.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeName } from '../src/fantasy/identity/normalize.mjs';

const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(arg('--port', 8722));
const ROOT = path.resolve('docs');
const liveFile = (league) => path.join(ROOT, 'data', `draft-live${league && /^[a-z0-9-]+$/i.test(league) ? '.' + league : ''}.json`);
const BOARD = path.join(ROOT, 'data', 'rankings.json');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/plain' };

function boardIndex() {
  if (!fs.existsSync(BOARD)) return new Map();
  const b = JSON.parse(fs.readFileSync(BOARD, 'utf8'));
  const m = new Map();
  for (const [pos, blk] of Object.entries(b.positions)) {
    for (const p of blk.players) {
      const n = normalizeName(p.name);
      m.set(n, { id: p.id, name: p.name, position: pos, rank_position: p.rank_position, tier: p.tier });
      m.set(`${n}|${pos}`, m.get(n));
    }
  }
  return m;
}

// ESPN D/ST rows arrive as "Texans D/ST"; the board has "Houston Texans".
const DST_NICK = { texans: 'houston texans', rams: 'los angeles rams', broncos: 'denver broncos', eagles: 'philadelphia eagles', ravens: 'baltimore ravens', bills: 'buffalo bills', steelers: 'pittsburgh steelers', vikings: 'minnesota vikings', lions: 'detroit lions', packers: 'green bay packers', chiefs: 'kansas city chiefs', seahawks: 'seattle seahawks', chargers: 'los angeles chargers', cardinals: 'arizona cardinals', commanders: 'washington commanders', '49ers': 'san francisco 49ers', buccaneers: 'tampa bay buccaneers', bears: 'chicago bears', jets: 'new york jets', colts: 'indianapolis colts', giants: 'new york giants', patriots: 'new england patriots', jaguars: 'jacksonville jaguars', falcons: 'atlanta falcons', panthers: 'carolina panthers', cowboys: 'dallas cowboys', dolphins: 'miami dolphins', saints: 'new orleans saints', bengals: 'cincinnati bengals', browns: 'cleveland browns', titans: 'tennessee titans', raiders: 'las vegas raiders' };

function resolve(idx, pick) {
  let n = normalizeName(pick.name || '');
  if (/d\/?st$/.test(n) || pick.pos === 'DST') {
    const nick = n.replace(/\s*d\/?st$/, '').trim();
    n = DST_NICK[nick] || n;
  }
  return idx.get(`${n}|${pick.pos}`) || idx.get(n) || null;
}

const server = http.createServer((req, res) => {
  // Chrome treats a public https page calling localhost as a "private network
  // access" and preflights it; without the allow-private-network answer the
  // request hangs rather than failing.
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Private-Network': 'true' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  if (req.method === 'POST' && req.url === '/api/draft-live') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const idx = boardIndex();
        let unresolved = 0;
        const picks = (data.picks || []).map((p) => {
          const hit = resolve(idx, p);
          if (!hit) unresolved++;
          return { n: p.n, round: p.round, teamId: p.teamId, teamName: p.teamName || null, name: p.name, pos: p.pos, team: p.team, keeper: !!p.keeper, id: hit?.id || null, board: hit ? `${hit.position}${hit.rank_position}` : null, tier: hit?.tier ?? null, mine: p.teamId === data.me };
        });
        const out = { updated: new Date().toISOString(), league: data.league || null, me: data.me, in_progress: !!data.in_progress, picks_made: picks.length, unresolved, picks };
        fs.writeFileSync(liveFile(data.league), JSON.stringify(out, null, 1));
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, picks: picks.length, unresolved }));
        const last = picks.at(-1);
        console.log(new Date().toLocaleTimeString(), `live: ${picks.length} picks` + (last ? ` — #${last.n} ${last.name} (${last.board || '?'})` : '') + (unresolved ? ` [${unresolved} unresolved]` : ''));
      } catch (e) {
        res.writeHead(400, cors); res.end('bad payload: ' + e.message);
      }
    });
    return;
  }

  // static
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, cors); return res.end('not found'); }
  res.writeHead(200, { ...cors, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => console.log(`serving ${ROOT} on :${PORT} (+ POST /api/draft-live)`));
