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
