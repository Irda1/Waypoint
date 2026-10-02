// Collecte des lieux d'une ville DEPUIS L'APPLI (OpenStreetMap via Overpass), en quelques secondes.
//
// Même tri que le pipeline (osm.ts est une copie exacte de pipeline/src/lib/osm.mjs), mais :
//  - les 4 groupes de requêtes partent en même temps, chacun sur un serveur différent au départ ;
//  - chaque requête est « doublée » : si un serveur n'a pas répondu après quelques secondes (ou répond « surchargé »),
//    on interroge le suivant sans attendre, la première réponse gagne ;
//  - pour les groupes très volumineux (restaurants, hôtels), on ne demande que les lieux qui ont un signal de notoriété
//    (site, horaires, Wikidata…) : ce sont les seuls que le tri garde de toute façon (voir MIN_SCORE).
import { GROUPS, buildOverpassQuery, elementToPlace, radiusForCity, selectEssential } from './osm.ts';

export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/** Signaux de notoriété : un lieu très répandu (restaurant, hôtel) n'est gardé que s'il en a au moins un. */
const SIGNALS = ['website', 'contact:website', 'opening_hours', 'wikidata', 'wikipedia'];
const FILTERED_GROUPS = new Set(['food']);
/** Maximum d'éléments lus par groupe : les services (distributeurs, toilettes…) sont des milliers dans une métropole. */
const GROUP_LIMIT: Record<string, number> = { services: 400, food: 1500, stays_transit: 1500, attractions: 3000 };
/** Plafond de lieux envoyés à la base en une fois (la base en accepte 1 500). */
export const MAX_SENT = 1400;

export interface CityInput { id: number; lat: number; lng: number; population?: number | null }
export interface OverpassElement { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

/** Requête Overpass d'un groupe, avec filtre de notoriété sur les groupes volumineux. */
export function buildFastQuery(group: string, args: { lat: number; lng: number; radiusM: number; timeoutS?: number }): string {
  const base = buildOverpassQuery(group, { ...args, timeoutS: args.timeoutS ?? 40 });
  let query = base;
  if (FILTERED_GROUPS.has(group)) {
    // Chaque sélecteur « nwr[...][name](around...) » devient une variante par signal.
    query = base.replace(/^(\s*)nwr(.*?)(\(around:[^)]*\));$/gm, (_m, indent: string, sel: string, around: string) =>
      SIGNALS.map((s) => `${indent}nwr${sel}["${s}"]${around};`).join('\n'));
  }
  return query.replace(/out center tags;\s*$/, `out center tags ${GROUP_LIMIT[group] ?? 2000};`);
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface HedgeOptions { mirrors?: string[]; startAt?: number; hedgeMs?: number; timeoutMs?: number; fetchImpl?: FetchLike }

/** Interroge Overpass : serveur de départ choisi, puis les suivants en renfort (immédiat sur erreur, sinon après `hedgeMs`). */
export function hedgedOverpass(query: string, opts: HedgeOptions = {}): Promise<OverpassElement[]> {
  const mirrors = opts.mirrors ?? OVERPASS_MIRRORS;
  const hedgeMs = opts.hedgeMs ?? 7000;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const start = opts.startAt ?? 0;
  const body = `data=${encodeURIComponent(query)}`;

  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let launched = 0;
    let failed = 0;
    let settled = false;
    let lastError = 'aucun serveur Overpass n\'a répondu';

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      for (const c of controllers) c.abort();
      fn();
    };

    const launch = () => {
      if (settled || launched >= mirrors.length) return;
      const url = mirrors[(start + launched) % mirrors.length];
      launched++;
      const ctl = new AbortController();
      controllers.push(ctl);
      timers.push(setTimeout(() => ctl.abort(), timeoutMs));
      if (launched < mirrors.length) timers.push(setTimeout(launch, hedgeMs));
      fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: ctl.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
          if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) throw new Error(json.remark);
          finish(() => resolve(json.elements ?? []));
        })
        .catch((err: unknown) => {
          if (settled) return;
          failed++;
          lastError = err instanceof Error ? err.message : String(err);
          if (launched < mirrors.length) launch();
          else if (failed >= launched) finish(() => reject(new Error(lastError)));
        });
    };
    launch();
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface CollectResult { rows: Record<string, unknown>[]; failedGroups: string[]; read: number }

/**
 * Lit les lieux d'une ville. Les 4 groupes partent ensemble ; un groupe en échec est retenté une fois.
 * Le groupe « attractions » est indispensable : sans lui la ville serait « prête » mais vide, donc on échoue.
 */
export async function collectCityPlaces(city: CityInput, opts: HedgeOptions & { onGroup?: (done: number, total: number) => void; retryDelayMs?: number } = {}): Promise<CollectResult> {
  const groups = Object.keys(GROUPS);
  const radiusM = radiusForCity(city.population);
  const retrievedAt = new Date().toISOString();
  let done = 0;
  const failedGroups: string[] = [];
  let read = 0;
  const mapped: Record<string, unknown>[] = [];

  await Promise.all(groups.map(async (group, i) => {
    const query = buildFastQuery(group, { lat: city.lat, lng: city.lng, radiusM });
    let elements: OverpassElement[] | null = null;
    for (let attempt = 0; attempt < 2 && elements === null; attempt++) {
      try {
        elements = await hedgedOverpass(query, { ...opts, startAt: i + attempt });
      } catch {
        if (attempt === 0) await sleep(opts.retryDelayMs ?? 1500);
      }
    }
    if (elements === null) failedGroups.push(group);
    else {
      read += elements.length;
      for (const el of elements) {
        const row = elementToPlace(el, city.id, { retrievedAt });
        if (row) mapped.push(row);
      }
    }
    done++;
    opts.onGroup?.(done, groups.length);
  }));

  if (failedGroups.includes('attractions')) throw new Error('Overpass : les lieux à visiter n\'ont pas pu être lus');
  if (failedGroups.length === groups.length) throw new Error('Overpass injoignable');
  const kept = selectEssential(mapped) as { popularity: number }[];
  kept.sort((a, b) => b.popularity - a.popularity);
  return { rows: (kept.slice(0, MAX_SENT) as unknown as Record<string, unknown>[]).map(toPayload), failedGroups, read };
}

const PAYLOAD_KEYS = ['kind', 'category_code', 'name', 'name_local', 'address', 'lat', 'lng', 'opening_hours', 'closed_days',
  'visit_duration_min', 'website', 'phone', 'popularity', 'osm_type', 'osm_id', 'wikidata_id', 'tags', 'source_url'];

/** Ne garde que les champs que la base accepte (moins de données à envoyer). */
export function toPayload(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PAYLOAD_KEYS) if (row[k] != null) out[k] = row[k];
  return out;
}

