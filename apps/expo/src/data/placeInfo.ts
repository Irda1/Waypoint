// Fiche d'un lieu : courte description (celle de la base, sinon l'introduction de sa page Wikipédia, CC BY-SA), photo de
// la page Wikipédia, horaires, adresse, site et téléphone de la base (OpenStreetMap).
// Les réponses sont gardées en mémoire le temps de la session ; en cas d'échec on n'affiche simplement rien.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { shortExtract, wikiTarget } from '../domain/wiki.ts';

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
  // Vignette Wikimedia en 640 px de large (assez nette pour le haut de la fiche, sans charger l'original).
  const photo = j.thumbnail?.source?.replace(/\/\d+px-/, '/640px-') ?? null;
  return { text: shortExtract(j.extract), photo };
}

async function frTitleFromWikidata(id: string): Promise<{ lang: string; title: string } | null> {
  const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=sitelinks&sitefilter=frwiki|enwiki&format=json&origin=*`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const links = ((await res.json()) as { entities?: Record<string, { sitelinks?: Record<string, { title: string }> }> }).entities?.[id]?.sitelinks ?? {};
  if (links.frwiki) return { lang: 'fr', title: links.frwiki.title };
  if (links.enwiki) return { lang: 'en', title: links.enwiki.title };
  return null;
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
  cache.set(placeId, info);
  return info;
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
