// Photos de villes (table media, remplie par la passe images du pipeline).
import type { ImageSourcePropType } from 'react-native';
import { supabase } from '../lib/supabase';

export interface CityCover { uri: string; small: string; credit: string | null }

export type MediaRow = { url_large: string | null; url_medium: string | null; attribution: string | null } | null;

export const COVER_FIELDS = 'cover_media:media!cities_cover_media_id_fkey(url_large,url_medium,attribution)';

export const toCover = (m: MediaRow): CityCover | null => {
  const uri = m?.url_large ?? m?.url_medium ?? null;
  return uri ? { uri, small: m?.url_medium ?? uri, credit: m?.attribution ?? null } : null;
};

/** Photo de la capitale de chaque pays demandé (code ISO), quand la collecte l'a trouvée. */
export async function capitalCovers(codes: string[]): Promise<Map<string, CityCover>> {
  const out = new Map<string, CityCover>();
  const list = [...new Set(codes.filter(Boolean))];
  if (!list.length) return out;
  const { data } = await supabase.from('cities').select(`country_code,${COVER_FIELDS}`).eq('is_capital', true).in('country_code', list);
  for (const r of (data ?? []) as unknown as { country_code: string; cover_media: MediaRow }[]) {
    const c = toCover(r.cover_media);
    if (c && !out.has(r.country_code)) out.set(r.country_code, c);
  }
  return out;
}

/** Photo de la base d'abord (capitale, ville du jour…), sinon celle intégrée à l'appli. */
export const pickSource = (fallback: ImageSourcePropType, ...covers: (CityCover | null | undefined)[]): { source: ImageSourcePropType; cover: CityCover | null } => {
  const cover = covers.find((c): c is CityCover => !!c) ?? null;
  return { source: cover ? { uri: cover.uri } : fallback, cover };
};
