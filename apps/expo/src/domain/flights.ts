// Liens de recherche de vols (Google Flights) : aucun prix n'est lu ici, on ouvre la recherche déjà remplie.

export interface FlightPlan {
  /** Ville (ou code d'aéroport) de départ du voyageur. */
  home: string;
  /** Arrivée (première ville du voyage) et retour (dernière ville) ; null si aucun aéroport proche. */
  arrive: string | null;
  leave: string | null;
  start: string | null;
  end: string | null;
}

export interface FlightLink { label: string; url: string }

function link(from: string, to: string, date: string | null, back?: string | null): string {
  const q = `Flights from ${from} to ${to}${date ? ` on ${date}` : ''}${back ? ` through ${back}` : ''}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

/** Un aller-retour si on repart de l'aéroport d'arrivée ; sinon deux allers simples (voyage « open jaw »). */
export function flightLinks(p: FlightPlan): FlightLink[] {
  const { home, arrive, leave, start, end } = p;
  if (!arrive) return [];
  const back = leave ?? arrive;
  if (back === arrive && start && end) return [{ label: `Aller-retour ${home} ⇄ ${arrive}`, url: link(home, arrive, start, end) }];
  const out: FlightLink[] = [{ label: `Aller ${home} → ${arrive}`, url: link(home, arrive, start) }];
  if (end) out.push({ label: `Retour ${back} → ${home}`, url: link(back, home, end) });
  return out;
}

export interface FlightEstimate {
  /** Billet le moins cher probable (aller simple, classe éco), en euros. */
  cheapest: number;
  /** Escale probable sur le trajet le moins cher. */
  stopover: boolean;
  /** Vol direct (aller simple, éco), en euros. */
  direct: number;
}

const round10 = (n: number): number => Math.round(n / 10) * 10;

/**
 * Estimation GROSSIÈRE d'après la distance à vol d'oiseau : ce n'est pas un prix lu chez une compagnie.
 * Aller simple en classe éco ; au-delà de ~1 200 km le billet le moins cher passe en général par une escale (environ 15 % moins cher).
 */
export function estimateFlight(km: number): FlightEstimate {
  const direct = km < 2500 ? 35 + 0.065 * km : 120 + 0.055 * km;
  const stopover = km >= 1200;
  return { cheapest: round10(stopover ? direct * 0.85 : direct), stopover, direct: round10(direct) };
}
