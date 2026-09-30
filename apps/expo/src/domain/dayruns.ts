// Regroupe les journées consécutives passées dans la même ville (bande « Lisbonne · 4 jours » de l'écran Jour).
// Fichier pur : testable avec Node.

export interface CityRun { cityId: number | null; start: number; count: number }

export function cityRuns(cityIds: (number | null)[]): CityRun[] {
  const runs: CityRun[] = [];
  cityIds.forEach((id, i) => {
    const last = runs[runs.length - 1];
    if (last && last.cityId === id) last.count++;
    else runs.push({ cityId: id, start: i, count: 1 });
  });
  return runs;
}
