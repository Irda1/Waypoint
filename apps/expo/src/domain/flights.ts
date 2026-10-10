// Liens de recherche de vols (Google Flights) : aucun prix n'est lu ici, on ouvre la recherche déjà remplie.
// Les prix de Google Flights ne sont pas accessibles par programme : l'appli affiche une estimation ≈ et le lien vers les vrais prix.

export interface FlightPlan {
  /** Ville de départ du voyageur (nom affiché) et son aéroport (code IATA). */
  home: string;
  homeIata: string;
  /** Arrivée (première ville du voyage) et retour (dernière ville) : nom et aéroport ; null si aucun aéroport proche. */
  arrive: { name: string; iata: string } | null;
  leave: { name: string; iata: string } | null;
  start: string | null;
  end: string | null;
  /** Nombre de voyageurs (adultes) : pré-rempli dans Google Flights. */
  adults: number;
}

export interface FlightLink { label: string; url: string }

// Lien Google Flights pré-rempli par le paramètre « tfs » (format protobuf en base64, celui des adresses de Google Flights) :
// trajets (date, aéroport de départ, aéroport d'arrivée), passagers adultes, classe éco, aller-retour ou aller simple.
// Le texte libre (« Flights from … to … ») ne gardait que la ville de départ.
const varint = (n: number): number[] => { const o: number[] = []; while (n > 127) { o.push((n & 127) | 128); n >>>= 7; } o.push(n); return o; };
const tag = (field: number, wire: number) => varint((field << 3) | wire);
const bytes = (field: number, b: number[]) => [...tag(field, 2), ...varint(b.length), ...b];
const text = (field: number, s: string) => bytes(field, [...new TextEncoder().encode(s)]);
const num = (field: number, n: number) => [...tag(field, 0), ...varint(n)];

export interface Leg { date: string | null; from: string; to: string }

export function googleFlightsUrl(legs: Leg[], adults: number): string {
  const b: number[] = [];
  for (const l of legs) b.push(...bytes(3, [...(l.date ? text(2, l.date) : []), ...bytes(13, text(2, l.from)), ...bytes(14, text(2, l.to))]));
  for (let i = 0; i < Math.max(1, Math.min(adults, 9)); i++) b.push(...num(8, 1));
  b.push(...num(9, 1), ...num(19, legs.length === 2 ? 1 : 2));
  const b64 = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `https://www.google.com/travel/flights?tfs=${b64}&hl=fr&curr=EUR`;
}

/** Un aller-retour si on repart de l'aéroport d'arrivée ; sinon deux allers simples (voyage « open jaw »). */
export function flightLinks(p: FlightPlan): FlightLink[] {
  const { home, homeIata, arrive, leave, start, end, adults } = p;
  if (!arrive) return [];
  const back = leave ?? arrive;
  const who = adults > 1 ? ` · ${adults} voyageurs` : '';
  if (back.iata === arrive.iata && start && end) {
    return [{ label: `Aller-retour ${home} ⇄ ${arrive.name}${who}`, url: googleFlightsUrl([{ date: start, from: homeIata, to: arrive.iata }, { date: end, from: arrive.iata, to: homeIata }], adults) }];
  }
  const out: FlightLink[] = [{ label: `Aller ${home} → ${arrive.name}${who}`, url: googleFlightsUrl([{ date: start, from: homeIata, to: arrive.iata }], adults) }];
  if (end) out.push({ label: `Retour ${back.name} → ${home}${who}`, url: googleFlightsUrl([{ date: end, from: back.iata, to: homeIata }], adults) });
  return out;
}

/** Durée de vol estimée (minutes) : direct ≈ 780 km/h + 40 min (décollage, atterrissage) ; avec escale ≈ 2 h 30 de plus. */
export function flightMinutes(km: number, stopover: boolean): number {
  return Math.round(((km / 780) * 60 + 40 + (stopover ? 150 : 0)) / 5) * 5;
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
