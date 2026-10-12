// Ajouter un lieu qui manque dans Waypoint : suggestions OpenStreetMap (service Photon) et lien Google Maps collé dans
// la recherche. Fonctions pures, testées sans réseau ; les appels sont dans data/addPlace.ts.
import { classify } from './osm.ts';

export interface ExternalPlace {
  name: string;
  lat: number;
  lng: number;
  category: string;
  address: string | null;
  km: number;
  source: 'osm' | 'google_maps';
  osm_type: 'node' | 'way' | 'relation' | null;
  osm_id: number | null;
}

/** Distance à vol d'oiseau en km. */
export function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Même limite que la base (add_user_place) : au-delà, le lieu n'est pas dans cette ville. */
export const MAX_KM = 60;

/** Type de lieu d'après l'étiquette OSM principale : le tri de la collecte, sinon la famille la plus proche. Null = ni activité ni service. */
export function categoryFromOsm(key: string, value: string): string | null {
  const c = classify({ [key]: value }) as { kind: string; category: string } | null;
  if (c) return c.kind === 'activity' || c.kind === 'service' ? c.category : null;
  if (key === 'shop') return ['bakery', 'pastry', 'confectionery', 'coffee', 'tea', 'chocolate'].includes(value) ? 'cafe' : 'shopping';
  if (key === 'amenity') return ['ice_cream', 'food_court', 'biergarten'].includes(value) ? 'gastronomie' : ['theatre', 'arts_centre', 'library'].includes(value) ? 'culture' : null;
  if (key === 'tourism') return ['hotel', 'hostel', 'guest_house', 'apartment', 'motel', 'camp_site', 'information'].includes(value) ? null : 'culture';
  if (key === 'leisure') return ['water_park', 'escape_game', 'bowling_alley', 'miniature_golf'].includes(value) ? 'sorties' : 'nature';
  if (key === 'natural' || key === 'waterway') return 'nature';
  if (key === 'historic' || key === 'building' || key === 'man_made') return 'culture';
  return null;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: { name?: string; osm_type?: string; osm_id?: number; osm_key?: string; osm_value?: string; street?: string; housenumber?: string; city?: string };
}

const OSM_TYPES = { N: 'node', W: 'way', R: 'relation' } as const;

/** Réponse Photon → lieux proposables (avec un nom, un type connu, à moins de 60 km de la ville), du plus proche au plus loin. */
export function photonPlaces(json: unknown, city: { lat: number; lng: number }, limit = 6): ExternalPlace[] {
  const features = ((json as { features?: PhotonFeature[] } | null)?.features ?? []);
  const out: ExternalPlace[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const p = f.properties ?? {};
    const [lng, lat] = f.geometry?.coordinates ?? [NaN, NaN];
    const type = OSM_TYPES[p.osm_type as keyof typeof OSM_TYPES];
    const name = p.name?.trim();
    if (!name || !type || !p.osm_id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const category = categoryFromOsm(p.osm_key ?? '', p.osm_value ?? '');
    const km = kmBetween(city.lat, city.lng, lat, lng);
    if (!category || km > MAX_KM || seen.has(`${type}${p.osm_id}`)) continue;
    seen.add(`${type}${p.osm_id}`);
    const address = [p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street, p.city].filter(Boolean).join(', ') || null;
    out.push({ name, lat, lng, category, address, km, source: 'osm', osm_type: type, osm_id: p.osm_id });
  }
  return out.slice(0, limit);
}

export type GoogleLink = { kind: 'place'; name: string; lat: number; lng: number } | { kind: 'short'; url: string } | { kind: 'unreadable' };

/** Le texte est-il un lien Google Maps ? Null sinon. */
export function parseGoogleMapsLink(text: string): GoogleLink | null {
  const raw = text.trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps'))) return { kind: 'short', url: raw };
  if (!/(^|\.)google\.[a-z.]+$/.test(host) || !(url.pathname.startsWith('/maps') || host.startsWith('maps.'))) return null;
  const decode = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')).trim(); } catch { return s.trim(); } };
  const nameMatch = /\/maps\/place\/([^/@]+)/.exec(url.pathname);
  const name = nameMatch ? decode(nameMatch[1]) : '';
  // Position du repère (!3d…!4d…), plus précise que le centre de la vue (@lat,lng).
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(raw);
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url.pathname);
  const q = url.searchParams.get('q') ?? url.searchParams.get('query') ?? '';
  const qCoords = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(q.trim());
  const m = pin ?? qCoords ?? view;
  const lat = m ? Number(m[1]) : NaN, lng = m ? Number(m[2]) : NaN;
  const label = name || (!qCoords && q ? decode(q) : '');
  if (!label || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { kind: 'unreadable' };
  return { kind: 'place', name: label.slice(0, 120), lat, lng };
}
