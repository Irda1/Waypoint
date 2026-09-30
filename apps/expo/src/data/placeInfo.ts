// Courte description d'un lieu : celle de la base si elle existe, sinon l'introduction de sa page Wikipédia (texte sous licence CC BY-SA).
// Les réponses sont gardées en mémoire le temps de la session ; en cas d'échec on n'affiche simplement rien.
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { shortExtract, wikiTarget } from '../domain/wiki.ts';

export interface PlaceInfo { text: string | null; source: 'base' | 'wikipedia' | null }

const cache = new Map<number, PlaceInfo>();

async function wikipediaSummary(lang: string, title: string): Promise<string | null> {
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  return shortExtract(((await res.json()) as { extract?: string }).extract);
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
  let info: PlaceInfo = { text: null, source: null };
  try {
    const { data } = await supabase.from('places').select('description,tags,wikidata_id').eq('id', placeId).maybeSingle();
    const row = data as { description: string | null; tags: Record<string, unknown> | null; wikidata_id: string | null } | null;
    const own = shortExtract(row?.description, 300);
    if (own) info = { text: own, source: 'base' };
    else if (row) {
      const target = wikiTarget(row);
      const page = target?.kind === 'title' ? { lang: target.lang, title: target.title } : target?.kind === 'wikidata' ? await frTitleFromWikidata(target.id) : null;
      const text = page ? await wikipediaSummary(page.lang, page.title) : null;
      if (text) info = { text, source: 'wikipedia' };
    }
  } catch { /* hors connexion ou service indisponible : pas de description */ }
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
  return { text: info?.text ?? null, source: info?.source ?? null, loading: enabled && placeId != null && info === null };
}
