#!/usr/bin/env node
// refresh.mjs — keep the local board current.
//
//   node scripts/refresh.mjs --watch          # watch for new exports, rebuild on arrival
//   node scripts/refresh.mjs                  # rebuild once from the newest capture
//   node scripts/refresh.mjs --serve 8722     # ... and serve docs/ while watching
//
// "Live" for this project means: the moment a fresher export lands, the board
// rebuilds and the open page picks it up on its next poll. The page itself
// cannot fetch fantasyguru.com — a browser blocks the cross-origin request,
// and publishing the response would redistribute a subscriber product
// (ADR-0001). So the pull happens here, on the machine that holds the
// subscription, and the published page never sees the data.
//
// Downloads that match EXPORT_MATCH are copied into data/raw/<source>/ under a
// timestamped name first. The capture is immutable (Principle 2); this script
// never edits one, only adds.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, spawn } from 'node:child_process';

const args = process.argv.slice(2);
const arg = (f, d = null) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

const SOURCE = arg('--source', 'fantasyguru');
// --full carries the rebuild all the way through: PPR board -> guillotine
// re-rank -> printable PDF. One download, everything current.
const FULL = args.includes('--full');
const TEAMS = arg('--teams', '18');
const FORMAT = arg('--format', 'ppr-1qb-12');
const WATCH_DIR = arg('--from', path.join(os.homedir(), 'Downloads'));
const EXPORT_MATCH = new RegExp(arg('--match', '^Jeff_Rankings.*\\.(xls|xlsx|html?)$'), 'i');
const RAW_DIR = path.join('data', 'raw', SOURCE);
const ROWS = path.join('data', 'processed', 'rows.json');
const BOARD = path.join('docs', 'data', 'rankings.json');

const stamp = (d = new Date()) => d.toISOString().replace(/\.\d+Z$/, '').replace(/:/g, '-');
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

function run(cmd, argv) {
  const r = spawnSync(cmd, argv, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.join(' ')} exited ${r.status}`);
}

/**
 * Copy a fresh export into the immutable capture tree.
 *
 * The file is PARSED FIRST. A download folder holds more than the export —
 * Excel writes a frameset `.html` beside its `.xls`, and a filename match
 * alone cannot tell them apart. Capturing an unparseable file would put
 * garbage in the evidentiary tree and, worse, hand the next stage an empty
 * board. So a file that yields no players is refused here and the capture
 * tree is left untouched.
 *
 * @returns {string|null} the capture path, or null if unchanged or refused.
 */
async function capture(src) {
  const body = fs.readFileSync(src);
  const text = body.toString('utf8');

  const { parse } = await import(`../src/fantasy/sources/${SOURCE}.mjs`);
  let parsed;
  try { parsed = parse(text, {}); } catch (e) { parsed = { players: [], rejections: [{ reason: e.message }] }; }
  if (!parsed.players.length) {
    log(`refused ${path.basename(src)} — parsed 0 players ` +
        `(${parsed.rejections[0]?.reason || 'no reason given'}). Existing board left alone.`);
    return null;
  }

  fs.mkdirSync(RAW_DIR, { recursive: true });
  for (const e of fs.readdirSync(RAW_DIR).filter((f) => CAPTURE_EXT.test(f))) {
    try { if (fs.readFileSync(path.join(RAW_DIR, e)).equals(body)) return null; } catch { /* skip */ }
  }
  const dest = path.join(RAW_DIR, `${stamp(fs.statSync(src).mtime)}-all-positions.html`);
  fs.writeFileSync(dest, body);
  log(`captured ${path.basename(src)} (${parsed.players.length} players) -> ${dest}`);
  return dest;
}

// Only captures this source's connector can actually parse. A directory can
// accumulate other artifacts — a reformatted workbook, a note — and picking
// the alphabetically-last file would quietly feed the parser something it
// cannot read, which then looks like an empty export rather than a mistake.
const CAPTURE_EXT = /\.html$/i;

function newestCapture() {
  if (!fs.existsSync(RAW_DIR)) return null;
  const files = fs.readdirSync(RAW_DIR)
    .filter((f) => !f.startsWith('.') && CAPTURE_EXT.test(f))
    .sort();
  return files.length ? path.join(RAW_DIR, files.at(-1)) : null;
}

function newestExport() {
  if (!fs.existsSync(WATCH_DIR)) return null;
  const hits = fs.readdirSync(WATCH_DIR)
    .filter((f) => EXPORT_MATCH.test(f))
    .map((f) => ({ f: path.join(WATCH_DIR, f), t: fs.statSync(path.join(WATCH_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return hits.length ? hits[0].f : null;
}

function rebuild(capturePath) {
  if (!capturePath) { log('no capture to build from'); return false; }
  run('node', ['scripts/ingest.mjs', '--source', SOURCE, '--capture', capturePath, '--format', FORMAT]);

  const rows = fs.existsSync(ROWS) ? JSON.parse(fs.readFileSync(ROWS, 'utf8')) : [];
  if (!rows.length) {
    log(`refusing to rebuild: ${ROWS} has no rows. The board on disk is left as it was.`);
    return false;
  }
  run('node', ['scripts/tier.mjs', '--in', ROWS, '--out', BOARD, '--format', FORMAT]);
  log(`board rebuilt from ${rows.length} rows -> ${BOARD}`);

  if (FULL) {
    // Each step is allowed to fail without taking the others down: a broken
    // PDF render should not cost you a rebuilt board minutes before a draft.
    for (const [label, argv] of [
      ['overall top-200 join', ['scripts/top200.mjs']],
      ['guillotine board', ['scripts/guillotine.mjs', '--teams', TEAMS]],
      ['printable sheet', ['scripts/pdf.mjs']],
    ]) {
      try { run('node', argv); log(`${label} rebuilt`); }
      catch (e) { log(`${label} FAILED: ${e.message}`); }
    }
  }
  return true;
}

// --- one-shot --------------------------------------------------------------
const fresh = newestExport();
if (fresh) await capture(fresh);
rebuild(newestCapture());

// --- serve -----------------------------------------------------------------
const port = arg('--serve', null);
if (port) {
  const srv = spawn('node', ['scripts/serve.mjs', '--port', String(port)], { stdio: 'inherit' });
  process.on('exit', () => srv.kill());
  log(`serving docs/ at http://localhost:${port}/cheatsheets/`);
}

// --- watch -----------------------------------------------------------------
if (args.includes('--watch')) {
  log(`watching ${WATCH_DIR} for ${EXPORT_MATCH}`);
  let debounce = null;
  fs.watch(WATCH_DIR, (_ev, filename) => {
    if (!filename || !EXPORT_MATCH.test(filename)) return;
    clearTimeout(debounce);
    // Downloads land in pieces; wait for the file to settle before reading it.
    debounce = setTimeout(async () => {
      try {
        const f = path.join(WATCH_DIR, filename);
        if (!fs.existsSync(f)) return;
        const c = await capture(f);
        if (c) rebuild(c);
        else log(`${filename} added nothing — already held, or refused as unparseable`);
      } catch (e) { log('refresh failed:', e.message); }
    }, 1500);
  });
  log('the open board polls every 45s and will pick up each rebuild on its own');
}
