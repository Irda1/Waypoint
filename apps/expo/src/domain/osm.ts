// @ts-nocheck — copie EXACTE de pipeline/src/lib/osm.mjs (un test vérifie l'égalité) : le tri et les seuils sont les mêmes dans l'appli et dans le pipeline.
// OpenStreetMap (ODbL 1.0, attribution « © contributeurs OpenStreetMap ») :
// requêtes Overpass, tri des étiquettes vers les catégories de l'app, score de
// popularité, durées estimées. Fonctions pures, testées sans réseau.

export const OSM_LICENSE = 'ODbL 1.0';

// ---------------------------------------------------------------------------
// Requêtes Overpass : plusieurs petits groupes plutôt qu'une énorme requête
// (Tokyo compte des dizaines de milliers de distributeurs et de restaurants).
// ---------------------------------------------------------------------------
export const GROUPS = {
  attractions: {
    radiusFactor: 1,
    selectors: [
      '["tourism"~"^(museum|gallery|attraction|viewpoint|theme_park|zoo|aquarium)$"]',
      '["historic"~"^(monument|castle|ruins|memorial|archaeological_site|fort|palace)$"]',
      '["leisure"~"^(park|garden|amusement_arcade|spa|stadium|sports_centre)$"]',
      '["natural"="beach"]',
      '["amenity"~"^(cinema|public_bath)$"]',
      '["amenity"="place_of_worship"]["wikidata"]',
      '["amenity"="place_of_worship"]["tourism"]',
      '["shop"~"^(mall|department_store|craft|pottery|art)$"]',
      '["craft"]["name"]',
    ],
  },
  food: {
    radiusFactor: 0.8,
    selectors: [
      '["amenity"~"^(restaurant|cafe|fast_food|marketplace|bar|pub|nightclub)$"]["name"]',
    ],
  },
  services: {
    radiusFactor: 0.6,
    selectors: [
      '["amenity"~"^(pharmacy|bank|atm|hospital|toilets|laundry)$"]',
      '["shop"="laundry"]',
    ],
  },
  stays_transit: {
    radiusFactor: 1,
    selectors: [
      '["tourism"~"^(hotel|hostel|guest_house|apartment|motel)$"]["name"]',
      '["railway"="station"]["name"]',
      '["amenity"="bus_station"]["name"]',
      '["aeroway"="aerodrome"]["iata"]',
    ],
  },
};

export function buildOverpassQuery(group, { lat, lng, radiusM, timeoutS = 90 }) {
  const spec = GROUPS[group];
  if (!spec) throw new Error(`Groupe Overpass inconnu : ${group}`);
  const r = Math.round(radiusM * spec.radiusFactor);
  const around = `(around:${r},${lat.toFixed(5)},${lng.toFixed(5)})`;
  const body = spec.selectors.map((s) => `  nwr${s}${around};`).join('\n');
  return `[out:json][timeout:${timeoutS}];\n(\n${body}\n);\nout center tags;`;
}

/** Rayon de recherche selon la taille de la ville (une métropole s'étend plus). */
export function radiusForCity(population) {
  const p = Number(population) || 0;
  if (p >= 5_000_000) return 9000;
  if (p >= 1_000_000) return 7000;
  if (p >= 200_000) return 5500;
  return 4000;
}

// ---------------------------------------------------------------------------
// Tri : étiquettes OSM -> { kind, category_code } (codes de place_categories)
// ---------------------------------------------------------------------------
export function classify(t) {
  // Services utiles (filtre « Pratique » : hors itinéraire)
  switch (t.amenity) {
    case 'pharmacy': return { kind: 'service', category: 'pharmacie' };
    case 'bank': return { kind: 'service', category: 'banque' };
    case 'atm': return { kind: 'service', category: 'distributeur' };
    case 'hospital': return { kind: 'service', category: 'hopital' };
    case 'toilets': return { kind: 'service', category: 'toilettes' };
    case 'laundry': return { kind: 'service', category: 'laverie' };
    default:
  }
  if (t.shop === 'laundry') return { kind: 'service', category: 'laverie' };

  // Transports
  if (t.aeroway === 'aerodrome' && t.iata) return { kind: 'transit', category: 'aeroport' };
  if (t.railway === 'station') {
    const subway = t.station === 'subway' || t.subway === 'yes' || t.station === 'light_rail';
    return { kind: 'transit', category: subway ? 'metro' : 'gare' };
  }
  if (t.amenity === 'bus_station') return { kind: 'transit', category: 'gare' };

  // Hébergement
  if (['hotel', 'hostel', 'guest_house', 'apartment', 'motel'].includes(t.tourism)) {
    return { kind: 'lodging', category: 'hebergement' };
  }

  // Culture
  if (t.tourism === 'museum') return { kind: 'activity', category: 'musee' };
  if (t.tourism === 'gallery') return { kind: 'activity', category: 'galerie' };
  if (t.amenity === 'place_of_worship') {
    const temple = ['shinto', 'buddhist', 'hindu', 'taoist', 'sikh'].includes(t.religion);
    return { kind: 'activity', category: temple ? 'temple' : 'monument' };
  }
  if (t.historic) return { kind: 'activity', category: 'monument' };
  if (t.tourism === 'attraction') return { kind: 'activity', category: 'monument' };

  // Nature
  if (t.tourism === 'viewpoint') return { kind: 'activity', category: 'point_de_vue' };
  if (t.natural === 'beach') return { kind: 'activity', category: 'plage' };
  if (t.leisure === 'park' || t.leisure === 'garden') return { kind: 'activity', category: 'parc' };
  if (t.tourism === 'zoo' || t.tourism === 'aquarium') return { kind: 'activity', category: 'parc' };

  // Divertissement
  if (t.amenity === 'cinema') return { kind: 'activity', category: 'cinema' };
  if (t.leisure === 'amusement_arcade') return { kind: 'activity', category: 'arcade' };
  if (t.tourism === 'theme_park') return { kind: 'activity', category: 'parc_attractions' };

  // Gastronomie et vie nocturne
  if (t.amenity === 'restaurant') return { kind: 'activity', category: 'restaurant' };
  if (t.amenity === 'cafe') return { kind: 'activity', category: 'cafe' };
  if (t.amenity === 'fast_food') return { kind: 'activity', category: 'street_food' };
  if (t.amenity === 'marketplace') return { kind: 'activity', category: 'marche' };
  if (t.amenity === 'bar' || t.amenity === 'pub') return { kind: 'activity', category: 'bar' };
  if (t.amenity === 'nightclub') return { kind: 'activity', category: 'club' };

  // Shopping, créatif, bien-être, sport
  if (t.shop === 'mall' || t.shop === 'department_store') return { kind: 'activity', category: 'centre_commercial' };
  if (t.craft || ['craft', 'pottery', 'art'].includes(t.shop)) return { kind: 'activity', category: 'atelier' };
  if (t.leisure === 'spa' || t.amenity === 'public_bath') return { kind: 'activity', category: 'spa' };
  if (t.leisure === 'stadium' || t.leisure === 'sports_centre') return { kind: 'activity', category: 'sport' };
  return null;
}

/** Durées de visite estimées (minutes) — toujours marquées « estimé » en base. */
export const DURATION_ESTIMATE = {
  musee: 90, monument: 45, temple: 45, galerie: 60, restaurant: 75, cafe: 45, street_food: 30,
  marche: 60, parc: 60, plage: 90, point_de_vue: 20, cinema: 150, arcade: 60, parc_attractions: 240,
  centre_commercial: 90, boutique: 45, atelier: 120, spa: 120, bar: 90, club: 180, sport: 90,
};

/** Maximum de lieux gardés par catégorie et par ville : on ne garde que l'essentiel. */
export const CAPS = {
  restaurant: 120, cafe: 60, street_food: 40, bar: 60, club: 30, marche: 30,
  musee: 100, galerie: 60, monument: 150, temple: 60, parc: 60, plage: 30, point_de_vue: 40,
  cinema: 20, arcade: 20, parc_attractions: 10, centre_commercial: 30, atelier: 80, spa: 30, sport: 30,
  hebergement: 80, gare: 40, metro: 120, aeroport: 5,
  pharmacie: 60, banque: 40, distributeur: 80, hopital: 30, toilettes: 60, laverie: 30,
};
// Catégories très nombreuses : sans signal de notoriété, on ne garde rien
export const MIN_SCORE = { restaurant: 1, cafe: 1, street_food: 1, bar: 1, club: 0.5, hebergement: 1, sport: 1 };

/** Notoriété d'un lieu à partir de ce qu'OSM en sait (sert à classer les suggestions). */
export function popularity(t) {
  let s = 0;
  if (t.wikidata) s += 3;
  if (t.wikipedia) s += 2;
  if (t.website || t['contact:website']) s += 1;
  if (t.opening_hours) s += 1;
  if (t.phone || t['contact:phone']) s += 0.5;
  if (t.stars) s += 0.5;
  if (t['name:en'] || t['name:fr']) s += 0.5;
  if (['museum', 'gallery', 'attraction', 'viewpoint'].includes(t.tourism)) s += 1;
  return s;
}

// ---------------------------------------------------------------------------
// Horaires : jours de fermeture déduits d'un opening_hours SIMPLE. Dès que le
// format est complexe (jours fériés, mois, semaines...), on renvoie [] (inconnu)
// plutôt que de deviner : « ne jamais présenter comme officiel ce qui est estimé ».
// ---------------------------------------------------------------------------
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const TIME_RANGES = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*$/;

/**
 * Règles lues dans l'ordre : une règle plus tardive remplace la précédente pour ses jours.
 * Selon la syntaxe OpenStreetMap, quand des horaires existent, un jour jamais cité est fermé.
 * @returns {number[]} jours fermés (0 = dimanche ... 6 = samedi), [] si inconnu ou trop complexe
 */
export function closedDaysFromOpeningHours(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const text = raw.trim();
  if (text === '24/7') return [];
  if (/[[\]"]|PH|SH|week|easter|sunrise|sunset|dawn|dusk|\d{4}|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(text)) return [];

  const state = Array(7).fill(null);
  for (const rule of text.split(';').map((r) => r.trim()).filter(Boolean)) {
    let days;
    let rest;
    const m = rule.match(/^([A-Za-z,\-]+)(?:\s+(.*))?$/);
    if (m && /^(Mo|Tu|We|Th|Fr|Sa|Su)/.test(m[1])) {
      days = expandDays(m[1]);
      rest = (m[2] || '').trim();
    } else if (/^\d{1,2}:\d{2}/.test(rule)) {
      days = [0, 1, 2, 3, 4, 5, 6];
      rest = rule;
    } else return [];
    if (!days) return [];

    const off = /^(off|closed)$/i.test(rest);
    if (!off && !TIME_RANGES.test(rest)) return [];
    for (const d of days) state[d] = off ? 'closed' : 'open';
  }
  if (!state.includes('open')) return [];
  return state.flatMap((v, d) => (v === 'open' ? [] : [d]));
}

function expandDays(part) {
  const out = [];
  for (const piece of part.split(',').filter(Boolean)) {
    const range = piece.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)$/);
    if (range) {
      let i = DAYS.indexOf(range[1]);
      const end = DAYS.indexOf(range[2]);
      for (let n = 0; n < 8; n++) { out.push(i); if (i === end) break; i = (i + 1) % 7; }
    } else if (DAYS.includes(piece)) out.push(DAYS.indexOf(piece));
    else return null;
  }
  return out.length ? out : null;
}

// ---------------------------------------------------------------------------
// Élément Overpass -> ligne de la table places
// ---------------------------------------------------------------------------
const FALLBACK_NAMES = {
  toilettes: 'Toilettes publiques', distributeur: 'Distributeur', banque: 'Banque',
  pharmacie: 'Pharmacie', hopital: 'Hôpital', laverie: 'Laverie',
};
const KEPT_TAGS = ['cuisine', 'brand', 'operator', 'religion', 'stars', 'wheelchair', 'fee', 'takeaway',
  'diet:vegetarian', 'diet:vegan', 'bath:type', 'iata', 'internet_access', 'outdoor_seating'];

function displayName(t, category) {
  const name = t['name:fr'] || t['name:en'] || t.name || t.brand || t.operator || FALLBACK_NAMES[category] || '';
  return String(name).trim();
}

function address(t) {
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const city = [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || null;
}

/**
 * @returns {object|null} ligne pour `places` (mêmes clés pour toutes les lignes),
 * ou null si l'élément est inutilisable. Les colonnes enrichies plus tard (prix,
 * description, google_place_id, photo) sont absentes : une nouvelle passe OSM ne les écrase pas.
 */
export function elementToPlace(el, cityId, { retrievedAt = new Date().toISOString() } = {}) {
  const t = el.tags;
  if (!t) return null;
  const cls = classify(t);
  if (!cls) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const name = displayName(t, cls.category);
  if (!name) return null;

  const tags = {};
  for (const k of KEPT_TAGS) if (t[k] != null) tags[k] = t[k];
  const duration = DURATION_ESTIMATE[cls.category] ?? null;
  const local = t.name && t.name !== name ? t.name : null;

  return {
    city_id: cityId,
    kind: cls.kind,
    category_code: cls.category,
    name,
    name_local: local,
    address: address(t),
    lat,
    lng,
    opening_hours: t.opening_hours || null,
    closed_days: closedDaysFromOpeningHours(t.opening_hours),
    visit_duration_min: cls.kind === 'activity' ? duration : null,
    duration_is_estimate: true,
    website: t.website || t['contact:website'] || null,
    phone: t.phone || t['contact:phone'] || null,
    popularity: popularity(t),
    osm_type: el.type,
    osm_id: el.id,
    wikidata_id: t.wikidata || null,
    tags,
    status: 'active',
    source: 'openstreetmap',
    license: OSM_LICENSE,
    source_url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    retrieved_at: retrievedAt,
  };
}

/** Garde l'essentiel : dédoublonne (OSM, Wikidata), applique seuils et plafonds par catégorie. */
export function selectEssential(places) {
  const byKey = new Map();
  for (const p of places) {
    const key = p.wikidata_id ? `wd:${p.wikidata_id}` : `${p.osm_type}:${p.osm_id}`;
    const prev = byKey.get(key);
    if (!prev || p.popularity > prev.popularity) byKey.set(key, p);
  }
  const groups = new Map();
  for (const p of byKey.values()) {
    if (p.popularity < (MIN_SCORE[p.category_code] ?? 0)) continue;
    if (!groups.has(p.category_code)) groups.set(p.category_code, []);
    groups.get(p.category_code).push(p);
  }
  const kept = [];
  for (const [cat, list] of groups) {
    list.sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name));
    kept.push(...list.slice(0, CAPS[cat] ?? 100));
  }
  return kept;
}
