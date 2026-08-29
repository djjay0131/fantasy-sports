// Canonical player identity.
//
// Identity resolution is the part of this pipeline that actually breaks in
// practice: name variants, suffixes, rookies with no prior-season row,
// players who changed teams. It is explicit rather than incidental, and an
// unresolved row is retained as a rejection, never dropped (Principle 5).

const SUFFIXES = /\s+(jr|sr|ii|iii|iv|v)\.?$/i;
const PUNCT = /['’.,]/g;

// Team relocations and common abbreviation variants seen across sources.
const TEAM_ALIASES = {
  JAC: 'JAX', WSH: 'WAS', LA: 'LAR', SD: 'LAC', OAK: 'LV', STL: 'LAR',
  ARZ: 'ARI', BLT: 'BAL', CLV: 'CLE', HST: 'HOU', SL: 'LAR', TAM: 'TB',
  KAN: 'KC', NWE: 'NE', NOR: 'NO', SFO: 'SF', GNB: 'GB',
};

export function normalizeTeam(team) {
  if (!team) return null;
  const t = String(team).trim().toUpperCase();
  return TEAM_ALIASES[t] || t;
}

export function normalizeName(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(PUNCT, '')
    .replace(SUFFIXES, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// A slug is a *candidate* key, not a canonical ID. The alias table promotes
// a slug to a canonical ID; anything it does not cover is a rejection.
export function slug(name, position) {
  return `${normalizeName(name).replace(/ /g, '-')}-${String(position).toLowerCase()}`;
}
