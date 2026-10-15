// Parcours principaux de l'appli, joués dans un vrai navigateur sur le site construit (voir playwright.config.ts).
import { expect, test } from '@playwright/test';
import { TRIP, USER, dayId, fakeServer, inDays, signIn } from './serveur';
import type { Write } from './serveur';

// ---------------------------------------------------------------- Données d'un voyage Porto → Lisbonne (4 jours)

let n = 100;
const place = (city: number, code: string, name: string, lat: number, lng: number, popularity: number, extra = {}) =>
  ({ id: ++n, city_id: city, name, kind: 'activity', category_code: code, lat, lng, price_amount: null, visit_duration_min: 90, closed_days: [], opening_hours: null, popularity, ...extra });
const porto = [
  place(1, 'musee', 'Livraria Lello', 41.1469, -8.6148, 90), place(1, 'musee', 'Sé do Porto', 41.1428, -8.6111, 80),
  place(1, 'musee', 'Torre dos Clérigos', 41.1458, -8.6139, 85, { visit_duration_min: 45 }), place(1, 'parc', 'Jardins do Palácio de Cristal', 41.1486, -8.6253, 60),
  place(1, 'restaurant', 'Taberna da Ribeira', 41.1405, -8.6125, 40), place(1, 'restaurant', 'Café Santiago', 41.146, -8.607, 35), place(1, 'restaurant', 'Cantinho do Avillez', 41.1495, -8.61, 30),
];
const lisboa = [
  place(2, 'musee', 'Castelo de São Jorge', 38.7139, -9.1335, 95), place(2, 'musee', 'Sé de Lisboa', 38.7098, -9.1335, 70, { visit_duration_min: 45 }),
  place(2, 'parc', 'Miradouro da Graça', 38.7163, -9.131, 60, { visit_duration_min: 30 }),
  place(2, 'restaurant', 'Taberna Alfama', 38.712, -9.13, 40), place(2, 'restaurant', 'Time Out Market', 38.7069, -9.1459, 60),
];
const pena = { id: 201, name: 'Palácio da Pena', kind: 'activity', category_code: 'musee', lat: 38.7876, lng: -9.3906, price_amount: 20, visit_duration_min: 120, closed_days: [], opening_hours: null };
const categories = [['culture', null, 'Culture'], ['gastronomie', null, 'Gastronomie'], ['nature', null, 'Nature'], ['transport', null, 'Transport'],
  ['musee', 'culture', 'Musées'], ['restaurant', 'gastronomie', 'Restaurants'], ['parc', 'nature', 'Parcs'], ['gare', 'transport', 'Gares'], ['aeroport', 'transport', 'Aéroports']]
  .map(([code, parent_code, name_fr], i) => ({ code, kind: code === 'transport' || parent_code === 'transport' ? 'transit' : 'activity', parent_code, name_fr, sort_order: i }));
const city = (name: string, name_fr: string, lat: number, lng: number) => ({ name, name_fr, lat, lng, country_code: 'PT', collection_status: 'ready', cover_media: null });
const item = (o: Record<string, unknown>) => ({ day_id: dayId(4), plan: 'A', place_id: null, title: null, category_code: null, duration_min: null, done: false, note: null, ...o });

/** Le voyage : nuit 1 à Porto, nuits 2 et 3 à Lisbonne (on part le soir du jour 2), jour 4 à Sintra déjà programmé. */
const tripTables = (extra: Record<string, unknown[]> = {}) => ({
  trips: [{ id: TRIP, title: 'Portugal du nord au sud', starts_on: inDays(5), ends_on: inDays(8), currency: 'EUR', country_code: 'PT', party_type: 'deux', travelers: 2, styles: ['culture'], budget_total: null, memo: '', deleted_at: null, version: 1, mode: 'complet', created_at: inDays(-3) }],
  trip_members: [{ user_id: USER, color: '#E8833A', left_at: null, profiles: { display_name: 'Adrien', avatar_url: null } }],
  trip_days: [
    { id: dayId(1), day_date: inDays(5), city_id: 1, stay_id: 's1', depart_time: null, return_time: null },
    { id: dayId(2), day_date: inDays(6), city_id: 1, stay_id: 's2', depart_time: null, return_time: null },
    { id: dayId(3), day_date: inDays(7), city_id: 2, stay_id: 's2', depart_time: null, return_time: null },
    { id: dayId(4), day_date: inDays(8), city_id: 2, stay_id: 's3', depart_time: null, return_time: null },
  ],
  trip_stays: [{ id: 's1', name: 'Casa da Ribeira', address: null, lat: 41.1405, lng: -8.613 }, { id: 's2', name: 'Hôtel Alfama', address: null, lat: 38.7115, lng: -9.13 }, { id: 's3', name: 'Quinta de Sintra', address: null, lat: 38.7975, lng: -9.388 }],
  trip_items: [
    item({ id: 'i1', title: 'Trajet Lisbonne → Sintra', category_code: 'transport', start_time: '09:00:00', duration_min: 45, position: 1, note: 'Train ou voiture, environ 45 min (estimation, 23 km)' }),
    item({ id: 'i2', title: 'Arrivée et installation', start_time: '09:45:00', duration_min: 30, position: 2, note: 'Quinta de Sintra : on dépose les bagages' }),
    item({ id: 'i3', place_id: 201, start_time: '10:30:00', position: 3 }),
    item({ id: 'i4', title: 'Déjeuner', category_code: 'gastronomie', start_time: '12:45:00', duration_min: 75, position: 4 }),
  ],
  trip_destinations: [{ trip_id: TRIP, city_id: 1, position: 1, nights: 1, cities: city('Porto', 'Porto', 41.1496, -8.611) }, { trip_id: TRIP, city_id: 2, position: 2, nights: 2, cities: city('Lisboa', 'Lisbonne', 38.7223, -9.1393) }],
  place_categories: categories,
  places: (q: URLSearchParams) => (q.get('city_id') === 'eq.1' ? porto : q.get('city_id') === 'eq.2' ? lisboa : q.get('id')?.startsWith('in.') ? [pena] : []),
  ...extra,
});
const posted = (writes: Write[], table: string) => writes.filter((w) => w.method === 'POST' && w.table === table).flatMap((w) => (Array.isArray(w.body) ? w.body : [w.body])) as Record<string, unknown>[];

// ---------------------------------------------------------------- Parcours

test('connexion : sans session, l\'écran de connexion s\'affiche', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('waypoint.welcomed', '1'));
  await fakeServer(page, {});
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer avec Google' })).toBeVisible();
});

test('accueil : le voyage apparaît et s\'ouvre', async ({ page }) => {
  await signIn(page);
  await fakeServer(page, tripTables());
  await page.goto('/');
  await page.getByRole('button', { name: /^Ouvrir Portugal du nord au sud/ }).click();
  await expect(page).toHaveURL(new RegExp(`/trip/${TRIP}`));
  await expect(page.getByText('Programme automatique', { exact: true })).toBeVisible();
});

test('programme automatique : vol réservé, trajet du soir vers l\'hôtel de Lisbonne, puis application', async ({ page }) => {
  await signIn(page, { [`waypoint.home.${TRIP}`]: JSON.stringify({ name: 'Paris', country_code: 'FR', lat: 48.8566, lng: 2.3522 }) });
  const writes = await fakeServer(page, tripTables({
    trip_bookings: [{ id: 'b1', kind: 'vol', title: 'Vol Paris → Porto', reference: 'TP4H2K', starts_on: inDays(5), start_time: '07:10', url: null, notes: 'TP 1953 · arrivée 08:25' }],
  }));
  await page.goto(`/trip/${TRIP}`);
  await page.getByRole('button', { name: 'Proposer un programme' }).click();
  await expect(page.getByText('Réservé · arrivée 08:25')).toBeVisible();
  await expect(page.getByText('Trajet Porto → Lisbonne')).toBeVisible();
  await page.getByRole('button', { name: 'Appliquer ce programme' }).click();
  await expect.poll(() => posted(writes, 'trip_items').length).toBeGreaterThan(5);
  const rows = posted(writes, 'trip_items');
  expect(rows).toContainEqual(expect.objectContaining({ day_id: dayId(1), title: 'Vol Paris → Porto', category_code: 'aeroport', start_time: '07:10', duration_min: 75 }));
  expect(rows).toContainEqual(expect.objectContaining({ day_id: dayId(1), title: 'Arrivée et installation', start_time: '09:25', note: 'Casa da Ribeira : on dépose les bagages' }));
  expect(rows).toContainEqual(expect.objectContaining({ day_id: dayId(2), title: 'Trajet Porto → Lisbonne', category_code: 'gare' }));
  expect(rows.every((r) => r.day_id !== dayId(4)), 'le jour déjà programmé n\'est pas touché').toBe(true);
});

test('onglet Jour : trajet et arrivée sans poignée, changer l\'heure du trajet décale la suite', async ({ page }) => {
  await signIn(page);
  const writes = await fakeServer(page, tripTables());
  await page.goto(`/trip/${TRIP}`);
  await page.getByRole('button', { name: 'Ouvrir le jour 4' }).click();
  await expect(page.getByText('Trajet Lisbonne → Sintra')).toBeVisible();
  await expect(page.getByLabel(/Glisser l'élément/)).toHaveCount(2);
  await page.getByRole('button', { name: 'Modifier l\'heure de Trajet Lisbonne → Sintra' }).click();
  await page.getByLabel('Heure de début').fill('10:00');
  await page.getByRole('button', { name: 'Enregistrer' }).first().click();
  const times = () => writes.filter((w) => w.method === 'PATCH' && w.table === 'trip_items').map((w) => `${w.query} ${(w.body as { start_time: string }).start_time}`).sort();
  await expect.poll(times).toEqual(['?id=eq.i1 10:00', '?id=eq.i2 10:45', '?id=eq.i3 11:15', '?id=eq.i4 13:15']);
});

test('réservations : importer un e-mail de confirmation (aller-retour TAP)', async ({ page }) => {
  await signIn(page);
  const writes = await fakeServer(page, tripTables({ trip_bookings: [] }));
  await page.goto(`/trip/${TRIP}`);
  await page.getByRole('button', { name: /^Transports et nuits/ }).click();
  await page.getByRole('button', { name: 'Importer un e-mail' }).click();
  await page.getByPlaceholder('Colle ici le texte de l\'e-mail').fill(`Votre réservation est confirmée
Référence de réservation : TP4H2K

ALLER  —  mardi 8 mai 2027
TP 437  Paris (CDG) 07:10 → Lisbonne (LIS) 08:45

RETOUR  —  samedi 15 mai 2027
TP 438  Lisbonne (LIS) 19:25 → Paris (CDG) 22:55`);
  await page.getByRole('button', { name: 'Lire l\'e-mail' }).click();
  await expect(page.getByText('2 réservations trouvées')).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter les 2 réservations' }).click();
  await expect.poll(() => posted(writes, 'trip_bookings').map((b) => `${b.title} ${b.starts_on} ${b.start_time}`))
    .toEqual(['Vol Paris → Lisbonne 2027-05-08 07:10', 'Vol Lisbonne → Paris 2027-05-15 19:25']);
});

test('partage : la page publique d\'un voyage s\'ouvre sans compte', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('waypoint.welcomed', '1'));
  await fakeServer(page, { place_categories: categories }, {
    shared_trip: {
      title: 'Portugal en famille', starts_on: inDays(5), ends_on: inDays(6), destinations: ['Lisboa'], stops: [{ name: 'Lisbonne', lat: 38.72, lng: -9.14 }],
      days: [{ date: inDays(5), city: 'Lisbonne', items: [{ time: '09:30', name: 'Tour de Belém', category: 'musee', note: null }] }, { date: inDays(6), city: 'Lisbonne', items: [] }],
    },
  });
  await page.goto('/share/jeton-de-test');
  await expect(page.getByRole('heading', { name: 'Portugal en famille' })).toBeVisible();
  await expect(page.getByText('Tour de Belém')).toBeVisible();
});
