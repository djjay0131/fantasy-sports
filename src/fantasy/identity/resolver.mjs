// Resolve (name, team, position) onto a canonical player ID.
//
// Every ingested row resolves before it is stored (Principle 4). Rows that
// do not resolve are returned as rejections with a reason and are retained
// (Principle 5) — they are the input to extending the alias table, and they
// are surfaced in every run report.

import { normalizeName, normalizeTeam, slug } from './normalize.mjs';

export class Resolver {
  /**
   * @param {{aliases?: Record<string,string>, players?: Record<string,object>}} table
   *   aliases: normalized-name-or-slug -> canonical id
   *   players: canonical id -> {name, team, position}
   */
  constructor(table = {}) {
    this.aliases = new Map(Object.entries(table.aliases || {}));
    this.players = new Map(Object.entries(table.players || {}));
    this.learned = new Map(); // slug -> canonical id, minted this run
  }

  /**
   * @returns {{ok: true, id: string, minted: boolean} | {ok: false, reason: string}}
   */
  resolve({ name, team, position }) {
    if (!name || !position) {
      return { ok: false, reason: 'missing name or position' };
    }
    const n = normalizeName(name);
    const t = normalizeTeam(team);
    const s = slug(name, position);

    for (const key of [`${n}|${t}|${position}`, s, n]) {
      const hit = this.aliases.get(key);
      if (hit) return { ok: true, id: hit, minted: false };
    }
    if (this.learned.has(s)) return { ok: true, id: this.learned.get(s), minted: false };

    // Mint a provisional canonical ID. Provisional IDs are reported so a
    // human can promote them into the alias table; they are never treated
    // as authoritative on their own.
    const id = t ? `${s}-${t.toLowerCase()}` : s;
    this.learned.set(s, id);
    this.players.set(id, { name: String(name).trim(), team: t, position });
    return { ok: true, id, minted: true };
  }

  /** Rows minted this run — the alias-table extension candidates. */
  mintedRows() {
    return [...this.learned.entries()].map(([s, id]) => ({
      slug: s, id, ...this.players.get(id),
    }));
  }

  toTable() {
    return {
      aliases: Object.fromEntries(this.aliases),
      players: Object.fromEntries(this.players),
    };
  }
}
