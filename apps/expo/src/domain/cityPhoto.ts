// Photo d'une ville cherchée à la demande sur Wikipédia (API REST « page/summary », sans clé), quand la base n'en a pas.
// On ne garde la photo que si la page parle bien de cette ville : coordonnées à moins de 40 km, image JPEG en paysage.
// Fichier pur : testable avec Node.

export interface WikiSummary {
  type?: string;
  coordinates?: { lat: number; lon: number };
  originalimage?: { source: string; width: number; height: number };
  thumbnail?: { source: string; width: number; height: number };
}

export interface FoundPhoto { uri: string; small: string; credit: string }

const MAX_KM = 40;

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Même image Wikimedia à une autre largeur (miniature « …/320px-Nom.jpg » → « …/1280px-Nom.jpg »). */
export function resizeThumb(url: string, width: number): string {
  return /\/\d+px-[^/]+$/.test(url) ? url.replace(/\/(\d+)px-([^/]+)$/, `/${width}px-$2`) : url;
}

/** Photo utilisable pour la ville (lat, lng), ou null si la page ne correspond pas ou si l'image ne convient pas. */
export function photoFromSummary(s: WikiSummary | null | undefined, lat: number, lng: number): FoundPhoto | null {
  if (!s || s.type === 'disambiguation' || !s.coordinates || !s.originalimage) return null;
  if (km(lat, lng, s.coordinates.lat, s.coordinates.lon) > MAX_KM) return null;
  const o = s.originalimage;
  if (!/\.jpe?g$/i.test(o.source) || o.width < 800 || o.width < o.height) return null;
  const thumb = s.thumbnail?.source;
  return {
    uri: thumb && o.width > 1280 ? resizeThumb(thumb, 1280) : o.source,
    small: thumb && o.width > 640 ? resizeThumb(thumb, 640) : o.source,
    credit: 'Photo : Wikimedia Commons',
  };
}
