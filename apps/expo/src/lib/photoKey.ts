// Choisit la photo d'ambiance de la maquette qui correspond le mieux au titre d'un voyage.
// Fichier pur (aucune dépendance) : testable avec Node. Les images sont associées dans src/theme/photos.ts.

export type PhotoKey = 'horizon' | 'lisbonne' | 'porto' | 'alfama' | 'marche' | 'atelier';

export function photoKeyFor(title: string): PhotoKey {
  const t = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/alfama/.test(t)) return 'alfama';
  if (/lisbo/.test(t)) return 'lisbonne';
  if (/porto/.test(t)) return 'porto';
  return 'horizon';
}
