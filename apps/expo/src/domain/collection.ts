export type CollectionStatus = 'empty' | 'queued' | 'collecting' | 'ready' | 'failed';

export interface CollectionProgress {
  /** Avancement de 0 à 100 : une ville prête compte pour 1, une ville en cours de collecte pour la moitié. */
  percent: number;
  ready: number;
  total: number;
  failed: number;
  /** Plus rien à attendre : toutes les villes sont prêtes ou en échec. */
  done: boolean;
}

/** Avancement du chargement des lieux des villes choisies, d'après l'état de collecte de chacune. */
export function collectionProgress(statuses: CollectionStatus[]): CollectionProgress {
  const total = statuses.length;
  if (!total) return { percent: 100, ready: 0, total: 0, failed: 0, done: true };
  const ready = statuses.filter((s) => s === 'ready').length;
  const failed = statuses.filter((s) => s === 'failed').length;
  const partial = statuses.filter((s) => s === 'collecting').length * 0.5;
  return { percent: Math.round(((ready + partial) / total) * 100), ready, total, failed, done: ready + failed === total };
}
