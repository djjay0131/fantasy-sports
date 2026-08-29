// Scoring format. Required on every rank row (ADR-0002): a rank without a
// format is a rejection, never a default.

export const FORMATS = {
  'ppr-1qb-12': { id: 'ppr-1qb-12', label: 'Full PPR / 1QB / 12-team', ppr: 1.0, qb: 1, teams: 12 },
  'half-1qb-12': { id: 'half-1qb-12', label: 'Half PPR / 1QB / 12-team', ppr: 0.5, qb: 1, teams: 12 },
  'std-1qb-12': { id: 'std-1qb-12', label: 'Standard / 1QB / 12-team', ppr: 0.0, qb: 1, teams: 12 },
  'ppr-sf-12': { id: 'ppr-sf-12', label: 'Full PPR / Superflex / 12-team', ppr: 1.0, qb: 2, teams: 12 },
};

export const DEFAULT_FORMAT = 'ppr-1qb-12';

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

export function parseFormat(id) {
  const f = FORMATS[id];
  if (!f) {
    throw new Error(
      `Unknown scoring format "${id}". Known: ${Object.keys(FORMATS).join(', ')}. ` +
      `A rank without a format is a rejection, not a default (ADR-0002).`
    );
  }
  return f;
}
