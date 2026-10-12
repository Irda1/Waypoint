// Courte description d'un lieu : on la prend dans la base, sinon dans Wikipédia (étiquette OpenStreetMap « wikipedia » ou identifiant Wikidata).
// Fonctions pures : l'appel réseau est dans data/placeInfo.ts.

export interface WikiSource { tags?: Record<string, unknown> | null; wikidata_id?: string | null }
export type WikiTarget = { kind: 'title'; lang: string; title: string } | { kind: 'wikidata'; id: string } | null;

/** « fr:Tour de Belém » → langue et titre ; à défaut l'identifiant Wikidata (Q…) ; sinon rien. */
export function wikiTarget(src: WikiSource): WikiTarget {
  const tag = src.tags && typeof src.tags.wikipedia === 'string' ? src.tags.wikipedia.trim() : '';
  const m = /^([a-z]{2,3}):(.+)$/i.exec(tag);
  if (m) return { kind: 'title', lang: m[1].toLowerCase(), title: m[2].trim() };
  const q = (src.wikidata_id ?? (src.tags && typeof src.tags.wikidata === 'string' ? src.tags.wikidata : '') ?? '').trim();
  return /^Q\d+$/.test(q) ? { kind: 'wikidata', id: q } : null;
}

/** Une ou deux phrases, au plus `max` caractères, coupées proprement ; vide si le texte ne dit rien d'utile. */
export function shortExtract(text: string | null | undefined, max = 240): string | null {
  const clean = (text ?? '').replace(/\s*\([^)]*\)/g, (m) => (m.length > 40 ? '' : m)).replace(/\s+/g, ' ').trim();
  if (clean.length < 20) return null;
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  let out = '';
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out = (out + s).trim() + ' ';
  }
  out = out.trim();
  if (!out) out = clean.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return out;
}

export type WikiPage = { lang: string; title: string };

/** Réponse Wikidata « wbgetentities » (sitelinks) → page Wikipédia de chaque identifiant demandé (français, sinon anglais ; null si aucune). */
export function wikidataPages(json: unknown, ids: string[]): Map<string, WikiPage | null> {
  const entities = (json as { entities?: Record<string, { sitelinks?: Record<string, { title: string }> }> } | null)?.entities ?? {};
  const out = new Map<string, WikiPage | null>();
  for (const id of ids) {
    const links = entities[id]?.sitelinks ?? {};
    out.set(id, links.frwiki ? { lang: 'fr', title: links.frwiki.title } : links.enwiki ? { lang: 'en', title: links.enwiki.title } : null);
  }
  return out;
}

/** Réponse Wikipédia « prop=pageimages » (formatversion=2) → vignette de chaque titre demandé, en suivant normalisations et redirections. */
export function pageThumbs(json: unknown, titles: string[]): Map<string, string | null> {
  const q = (json as { query?: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages?: { title: string; thumbnail?: { source?: string } }[] } } | null)?.query ?? {};
  const hop = (list: { from: string; to: string }[] | undefined, t: string) => list?.find((x) => x.from === t)?.to ?? t;
  const byTitle = new Map((q.pages ?? []).map((p) => [p.title, p.thumbnail?.source ?? null] as const));
  return new Map(titles.map((t) => [t, byTitle.get(hop(q.redirects, hop(q.normalized, t))) ?? null]));
}
