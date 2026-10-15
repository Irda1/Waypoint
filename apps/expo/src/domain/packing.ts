// Valise : affaires proposées selon le voyage (météo, durée, voyageurs, programme, pays), chacune avec sa raison.
// Calcul pur : l'écran fournit le contexte, les idées retenues vont dans la liste commune « trip_checklist ».

export const GROUPS = ['Papiers', 'Vêtements', 'Santé', 'Électronique', 'Enfants', 'Activités', 'Autres'] as const;
export type PackGroup = (typeof GROUPS)[number];

export interface PackIdea { group: PackGroup; label: string; why: string }

export interface PackContext {
  country: string | null;      // code ISO du pays du voyage
  currency: string;            // monnaie du voyage
  nights: number;
  party: 'seul' | 'deux' | 'amis' | 'famille' | null;
  month: number | null;        // mois du départ (1 à 12)
  lat: number | null;          // latitude de la première ville
  /** Prévisions sur les jours du voyage ; `covered` faux quand le départ est trop loin pour la météo. */
  weather: { covered: boolean; min: number | null; max: number | null; rainy: { city: string; date: string }[] };
  /** Étapes du programme : code de catégorie (sous-catégorie ou principale), nom du lieu, date du jour. */
  activities: { code: string; name: string; date: string }[];
}

// Carte d'identité et carte européenne d'assurance maladie : Union européenne, EEE et Suisse.
const EUROPE = new Set(['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'IS', 'LI', 'NO', 'CH']);
// Prises où une fiche française (C/E/F) ne rentre pas.
const PLUG: Record<string, string> = {
  GB: 'G', IE: 'G', MT: 'G', CY: 'G', HK: 'G', SG: 'G', MY: 'G', AE: 'G', QA: 'G', KE: 'G',
  US: 'A/B', CA: 'A/B', MX: 'A/B', JP: 'A', TW: 'A/B', PH: 'A/B', CO: 'A/B', CR: 'A/B', CU: 'A/B', DO: 'A/B',
  AU: 'I', NZ: 'I', CN: 'I', AR: 'I', FJ: 'I', IN: 'D', ZA: 'M', IL: 'H',
};
// Sous-catégorie → catégorie principale (place_categories, migration 0200).
const ROOT: Record<string, string> = { parc: 'nature', plage: 'nature', point_de_vue: 'nature', spa: 'bienetre', bar: 'nocturne', club: 'nocturne', temple: 'culture' };
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const weekday = (iso: string) => DAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

/** Nombre de vêtements par personne : un par nuit jusqu'à une semaine, puis une lessive (la moitié), 7 au plus. */
export function perPerson(nights: number): number {
  const n = Math.max(1, nights);
  return Math.min(7, n > 7 ? Math.ceil(n / 2) : n);
}

export function packingIdeas(c: PackContext): PackIdea[] {
  const out: PackIdea[] = [];
  const add = (group: PackGroup, label: string, why: string) => { if (!out.some((i) => i.label === label)) out.push({ group, label, why }); };
  const europe = c.country ? EUROPE.has(c.country) : false;

  // Papiers
  if (europe) {
    add('Papiers', 'Carte d\'identité ou passeport', 'Europe : la carte d\'identité suffit');
    add('Papiers', 'Carte européenne d\'assurance maladie', 'soins en Europe');
  } else if (c.country) {
    add('Papiers', 'Passeport', 'hors Europe : obligatoire');
    add('Papiers', 'Assurance voyage', 'soins à l\'étranger');
  }
  add('Papiers', 'Billets et réservations', 'toujours utile');
  add('Papiers', 'Carte bancaire', 'toujours utile');
  if (c.currency && c.currency !== 'EUR') add('Papiers', `Un peu d'espèces en ${c.currency}`, 'monnaie locale');

  // Vêtements
  if (c.nights > 0) {
    const n = perPerson(c.nights);
    const why = c.nights > 7 ? `${c.nights} nuits, une lessive` : `${c.nights} nuit${c.nights > 1 ? 's' : ''}`;
    add('Vêtements', `T-shirts · ${n} par personne`, why);
    add('Vêtements', `Sous-vêtements et chaussettes · ${n} par personne`, why);
  }
  const w = c.weather;
  if (w.covered) {
    if (w.min !== null && w.min <= 3) { add('Vêtements', 'Manteau chaud', `jusqu'à ${Math.round(w.min)} °C`); add('Vêtements', 'Gants et bonnet', `jusqu'à ${Math.round(w.min)} °C`); }
    else if (w.min !== null && w.min <= 14) add('Vêtements', 'Pull ou polaire', `soirées à ${Math.round(w.min)} °C`);
    if (w.rainy.length) {
      const r = w.rainy[0], more = w.rainy.length - 1;
      add('Vêtements', 'Imperméable ou parapluie', `pluie prévue à ${r.city} ${weekday(r.date)}${more ? ` et ${more} autre${more > 1 ? 's' : ''} jour${more > 1 ? 's' : ''}` : ''}`);
    }
    if (w.max !== null && w.max >= 24) {
      add('Santé', 'Crème solaire', `jusqu'à ${Math.round(w.max)} °C`);
      add('Vêtements', 'Lunettes de soleil et casquette', `jusqu'à ${Math.round(w.max)} °C`);
    }
  } else if (c.month) {
    // Trop loin pour la météo : la saison selon le mois et l'hémisphère.
    const south = (c.lat ?? 0) < 0, m = c.month, name = MONTHS[m - 1];
    const summer = south ? [12, 1, 2].includes(m) : [6, 7, 8].includes(m);
    const winter = south ? [6, 7, 8].includes(m) : [12, 1, 2].includes(m);
    const tropical = Math.abs(c.lat ?? 45) < 23.5;
    if (summer || tropical) { add('Santé', 'Crème solaire', tropical ? 'climat tropical' : `${name} : plein été`); add('Vêtements', 'Lunettes de soleil et casquette', tropical ? 'climat tropical' : `${name} : plein été`); }
    else if (winter && Math.abs(c.lat ?? 45) >= 35) { add('Vêtements', 'Manteau chaud', `${name} : hiver`); add('Vêtements', 'Gants et bonnet', `${name} : hiver`); }
    else add('Vêtements', 'Pull ou polaire', `${name} : mi-saison`);
  }

  // Santé, électronique
  add('Santé', 'Trousse de médicaments', 'toujours utile');
  add('Électronique', 'Chargeurs et batterie externe', 'toujours utile');
  const plug = c.country ? PLUG[c.country] : undefined;
  if (plug) add('Électronique', `Adaptateur de prise type ${plug}`, 'prises différentes des prises françaises');

  // Enfants
  if (c.party === 'famille') {
    add('Enfants', 'Doudou et jeux pour le trajet', 'voyage en famille');
    add('Enfants', 'Gourde et goûters', 'journées de visite');
    add('Enfants', 'Carnet de santé des enfants', 'voyage en famille');
  }

  // Activités du programme (la première de chaque genre donne la raison)
  for (const a of [...c.activities].sort((x, y) => x.date.localeCompare(y.date))) {
    const root = ROOT[a.code] ?? a.code, when = `${a.name} ${weekday(a.date)}`;
    if (a.code === 'plage' || a.code === 'spa' || root === 'bienetre') add('Activités', 'Maillot de bain et serviette', when);
    else if (root === 'nature') add('Activités', 'Chaussures de marche', when);
    if (root === 'sport') add('Activités', 'Tenue de sport', when);
    if (root === 'nocturne') add('Activités', 'Une tenue pour sortir', when);
    if (a.code === 'temple') add('Activités', 'Tenue couvrant épaules et genoux', `${a.name} (lieu de culte)`);
  }
  return out;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
/** Nom sans la quantité (« T-shirts · 5 par personne » → « t-shirts ») : la quantité peut changer avec les dates. */
export const baseLabel = (label: string) => norm(label.split(' · ')[0]);

/** Famille d'un élément de la liste : celle de l'idée de même nom, sinon « Autres » (ajouté à la main). */
export function groupOf(label: string, ideas: PackIdea[]): PackGroup {
  const b = baseLabel(label);
  return ideas.find((i) => baseLabel(i.label) === b)?.group ?? 'Autres';
}

/** Idées pas encore dans la liste, ni écartées par les voyageurs. */
export function newIdeas(ideas: PackIdea[], labels: string[], dismissed: string[]): PackIdea[] {
  const have = new Set([...labels, ...dismissed].map(baseLabel));
  return ideas.filter((i) => !have.has(baseLabel(i.label)));
}

/** Repères affichés en tête de la valise. */
export function packFacts(c: PackContext): string[] {
  const out: string[] = [];
  const w = c.weather;
  if (w.covered && w.min !== null && w.max !== null) out.push(`${Math.round(w.min)} – ${Math.round(w.max)} °C`);
  if (w.covered && w.rainy.length) out.push(`pluie ${w.rainy.length} jour${w.rainy.length > 1 ? 's' : ''}`);
  if (c.nights > 0) out.push(`${c.nights} nuit${c.nights > 1 ? 's' : ''}`);
  if (c.country && PLUG[c.country]) out.push(`prises type ${PLUG[c.country]} : adaptateur`);
  else if (c.country && EUROPE.has(c.country)) out.push('prises : rien à prévoir');
  if (c.currency && c.currency !== 'EUR') out.push(c.currency);
  return out;
}
