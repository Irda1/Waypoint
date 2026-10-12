// Fiche d'un lieu : courte description (celle de la base, sinon l'introduction de sa page Wikipédia, CC BY-SA), photo de
// la page Wikipédia, horaires, adresse, site et téléphone de la base (OpenStreetMap).
// Les fiches sont gardées en mémoire le temps de la session ; les adresses des photos restent sur l'appareil.
// En cas d'échec on n'affiche simplement rien.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { resizeThumb } from '../domain/cityPhoto.ts';
import { pageThumbs, shortExtract, wikidataPages, wikiTarget } from '../domain/wiki.ts';
import type { WikiPage, WikiSource, WikiTarget } from '../domain/wiki.ts';

export interface PlaceInfo {
  text: string | null; source: 'base' | 'wikipedia' | null;
  photo: string | null; hours: string | null; address: string | null; website: string | null; phone: string | null;
}
const EMPTY: PlaceInfo = { text: null, source: null, photo: null, hours: null, address: null, website: null, phone: null };

const cache = new Map<number, PlaceInfo>();

async function wikipediaSummary(lang: string, title: string): Promise<{ text: string | null; photo: string | null } | null> {
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const j = (await res.json()) as { extract?: string; thumbnail?: { source?: string } };
  // Vignette Wikimedia de 330 px (le haut de la fiche demande 500 px au moment de l'afficher).
  const photo = j.thumbnail?.source ? resizeThumb(j.thumbnail.source, 330) : null;
  return { text: shortExtract(j.extract), photo };
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Pages Wikipédia d'identifiants Wikidata (au plus 50) en une seule demande. */
async function pagesFromWikidata(ids: string[]): Promise<Map<string, WikiPage | null>> {
  return wikidataPages(await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=sitelinks&sitefilter=frwiki|enwiki&format=json&origin=*`), ids);
}

async function frTitleFromWikidata(id: string): Promise<WikiPage | null> {
  return (await pagesFromWikidata([id])).get(id) ?? null;
}

export async function loadPlaceInfo(placeId: number): Promise<PlaceInfo> {
  const hit = cache.get(placeId);
  if (hit) return hit;
  let info: PlaceInfo = EMPTY;
  try {
    const { data } = await supabase.from('places').select('description,tags,wikidata_id,opening_hours,address,website,phone').eq('id', placeId).maybeSingle();
    const row = data as { description: string | null; tags: Record<string, unknown> | null; wikidata_id: string | null; opening_hours: string | null; address: string | null; website: string | null; phone: string | null } | null;
    if (row) {
      const own = shortExtract(row.description, 300);
      info = { ...EMPTY, text: own, source: own ? 'base' : null, hours: row.opening_hours, address: row.address, website: row.website, phone: row.phone };
      const target = wikiTarget(row);
      const page = target?.kind === 'title' ? { lang: target.lang, title: target.title } : target?.kind === 'wikidata' ? await frTitleFromWikidata(target.id) : null;
      const wiki = page ? await wikipediaSummary(page.lang, page.title).catch(() => null) : null;
      if (wiki) info = { ...info, photo: wiki.photo, ...(own || !wiki.text ? {} : { text: wiki.text, source: 'wikipedia' as const }) };
    }
  } catch { /* hors connexion ou service indisponible : fiche sans ces informations */ }
  if (!info.photo && photos.get(placeId)) info = { ...info, photo: photos.get(placeId) ?? null };
  cache.set(placeId, info);
  if (info.photo) photos.set(placeId, info.photo);
  return info;
}

// --- Photos des lieux -------------------------------------------------------------------------------------------
// Les lieux affichés ensemble (grille du mode Simple…) sont cherchés d'un coup : une demande Wikidata et une demande
// Wikipédia par langue pour 50 lieux, au lieu de deux par lieu. Les adresses trouvées restent sur l'appareil ;
// un lieu sans photo est recherché de nouveau au bout d'une semaine.
const KEY = 'waypoint.placephoto.v1';
const RETRY_MS = 7 * 24 * 3600 * 1000;
type Stored = Record<string, [string | null, number]>;

const photos = new Map<number, string | null>();
const pending = new Map<number, Promise<string | null>>();
let stored: Promise<Stored> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const readStored = () => (stored ??= AsyncStorage.getItem(KEY).then((raw) => (raw ? (JSON.parse(raw) as Stored) : {})).catch(() => ({} as Stored)));

function remember(placeId: number, url: string | null) {
  photos.set(placeId, url);
  void readStored().then((s) => {
    s[placeId] = [url, Date.now()];
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => undefined); }, 800);
  });
}

const chunks = <T,>(list: T[], n: number): T[][] => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

type Wanted = { id: number; target: NonNullable<WikiTarget>; done: (url: string | null) => void };
let queue: Wanted[] = [];

async function flush() {
  const batch = queue;
  queue = [];
  // 1. Identifiants Wikidata → pages Wikipédia. Une demande qui échoue laisse ses lieux « inconnus » (rien n'est gardé).
  const pages = new Map<string, WikiPage | null>();
  const qids = [...new Set(batch.flatMap((w) => (w.target.kind === 'wikidata' ? [w.target.id] : [])))];
  for (const part of chunks(qids, 50)) {
    try { for (const [k, v] of await pagesFromWikidata(part)) pages.set(k, v); } catch { /* hors connexion */ }
  }
  const pageOf = (w: Wanted): WikiPage | null | undefined => (w.target.kind === 'title' ? { lang: w.target.lang, title: w.target.title } : pages.get(w.target.id));
  // 2. Pages → vignettes de 330 px, par langue.
  const byLang = new Map<string, Set<string>>();
  for (const w of batch) {
    const p = pageOf(w);
    if (p) byLang.set(p.lang, (byLang.get(p.lang) ?? new Set()).add(p.title));
  }
  const thumbs = new Map<string, string | null>();
  for (const [lang, titles] of byLang) {
    for (const part of chunks([...titles], 50)) {
      try {
        const json = await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=330&titles=${encodeURIComponent(part.join('|'))}`);
        for (const [t, u] of pageThumbs(json, part)) thumbs.set(`${lang}:${t}`, u ? resizeThumb(u, 330) : null);
      } catch { /* hors connexion */ }
    }
  }
  for (const w of batch) {
    const p = pageOf(w);
    const key = p ? `${p.lang}:${p.title}` : '';
    const known = p === null || (p !== undefined && thumbs.has(key));
    const url = p ? thumbs.get(key) ?? null : null;
    if (known) remember(w.id, url);
    w.done(url);
  }
}

/** Photo Wikipédia d'un lieu (sans relire la base : étiquettes déjà chargées), en 330 px de large. */
export function loadPlacePhoto(placeId: number, src: WikiSource): Promise<string | null> {
  if (photos.has(placeId)) return Promise.resolve(photos.get(placeId) ?? null);
  const target = wikiTarget(src);
  if (!target) return Promise.resolve(null);
  let p = pending.get(placeId);
  if (!p) {
    p = (async () => {
      const hit = (await readStored())[placeId];
      if (hit && (hit[0] || Date.now() - hit[1] < RETRY_MS)) { photos.set(placeId, hit[0]); return hit[0]; }
      return new Promise<string | null>((done) => {
        queue.push({ id: placeId, target, done });
        if (queue.length === 1) setTimeout(() => void flush(), 30);
      });
    })().finally(() => pending.delete(placeId));
    pending.set(placeId, p);
  }
  return p;
}

/** Photo déjà connue d'un lieu (sans rien chercher). */
export const knownPlacePhoto = (placeId: number | null): string | null => (placeId != null ? photos.get(placeId) ?? null : null);

/** Photo d'un lieu : undefined pendant la recherche, null s'il n'y en a pas. */
export function usePlacePhoto(placeId: number, src: WikiSource): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(photos.has(placeId) ? photos.get(placeId) : wikiTarget(src) ? undefined : null);
  useEffect(() => {
    let alive = true;
    void loadPlacePhoto(placeId, src).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [placeId]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

export function usePlaceInfo(placeId: number | null, enabled = true): PlaceInfo & { loading: boolean } {
  const [info, setInfo] = useState<PlaceInfo | null>(placeId != null ? cache.get(placeId) ?? null : null);
  useEffect(() => {
    if (!enabled || placeId == null) { setInfo(null); return; }
    let alive = true;
    const hit = cache.get(placeId);
    if (hit) { setInfo(hit); return; }
    setInfo(null);
    void loadPlaceInfo(placeId).then((r) => { if (alive) setInfo(r); });
    return () => { alive = false; };
  }, [placeId, enabled]);
  return { ...(info ?? EMPTY), loading: enabled && placeId != null && info === null };
}
