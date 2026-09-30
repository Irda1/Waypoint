// Photo de couverture d'une ville (table media, remplie par la passe images du pipeline).
import type { ImageSourcePropType } from 'react-native';

export interface CityCover { uri: string; credit: string | null }

type MediaRow = { url_large: string | null; url_medium: string | null; attribution: string | null } | null;

export const toCover = (m: MediaRow): CityCover | null => {
  const uri = m?.url_large ?? m?.url_medium ?? null;
  return uri ? { uri, credit: m?.attribution ?? null } : null;
};

/** Photo choisie à la main dans l'appli d'abord (Lisbonne, Porto…), sinon celle de la base, sinon l'horizon. */
export function coverSource(key: string, fallback: ImageSourcePropType, cover: CityCover | null): ImageSourcePropType {
  return key === 'horizon' && cover ? { uri: cover.uri } : fallback;
}
