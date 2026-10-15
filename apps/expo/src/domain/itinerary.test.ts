import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARRIVAL, DAY_START, TRANSFER_DEPART, buildPlan, dayCost, estimateTransfer, isFixedStep, organizeTimes } from './itinerary.ts';
import type { Candidate } from './itinerary.ts';
import type { LatLng, Place } from './types.ts';

let n = 0;
const place = (over: Partial<Place> = {}): Place => ({ id: ++n, name: `Lieu ${n}`, kind: 'activity', category_code: 'musee', lat: 38.7 + n * 0.001, lng: -9.14, price_amount: null, visit_duration_min: 60, closed_days: [], ...over });
const cand = (root: string, pop = 1, over: Partial<Place> = {}, cityId = 1): Candidate => ({ place: place(over), cityId, root, popularity: pop });

// 2026-10-13 est un mardi (2), 2026-10-12 un lundi (1), 2026-10-14 un mercredi (3)
const D = (date: string, cityId: number | null = 1) => ({ date, cityId });
const base = { interests: ['culture'], travelers: 2 };

function pool(): Candidate[] {
  return [
    ...Array.from({ length: 8 }, (_, i) => cand('culture', 10 - i)),
    ...Array.from({ length: 3 }, (_, i) => cand('nature', 5 - i)),
    ...Array.from({ length: 6 }, (_, i) => cand('gastronomie', 6 - i)),
  ];
}

test('jour d\'arrivée : commence l\'après-midi avec au plus 2 visites, déjeuner et dîner', () => {
  const [day] = buildPlan([D('2026-10-13')], pool(), base);
  assert.equal(day.transfer, true);
  assert.equal(day.items[0].kind, 'arrival');
  const visits = day.items.filter((i) => i.kind === 'visit');
  assert.ok(visits.length >= 1 && visits.length <= 2);
  assert.ok(visits.every((v) => v.startMin >= ARRIVAL));
  assert.equal(day.items.at(-1)?.kind, 'dinner');
});

test('jour normal : matinée dès 9 h 30, déjeuner vers 12 h 30, dîner à 20 h, ordre chronologique sans chevauchement', () => {
  const days = buildPlan([D('2026-10-13'), D('2026-10-14')], pool(), base);
  const d = days[1];
  assert.equal(d.transfer, false);
  assert.equal(d.items[0].startMin, DAY_START);
  const lunch = d.items.find((i) => i.kind === 'lunch')!;
  assert.ok(lunch.startMin >= 12 * 60 && lunch.startMin <= 13 * 60 + 30, `déjeuner à ${lunch.startMin}`);
  assert.equal(d.items.find((i) => i.kind === 'dinner')!.startMin, 20 * 60);
  for (let i = 1; i < d.items.length; i++) assert.ok(d.items[i].startMin >= d.items[i - 1].startMin + d.items[i - 1].durationMin, `chevauchement à l'étape ${i}`);
});

test('un lieu n\'est jamais proposé deux fois dans le voyage', () => {
  const days = buildPlan([D('2026-10-13'), D('2026-10-14'), D('2026-10-15')], pool(), base);
  const ids = days.flatMap((d) => d.items.map((i) => i.place?.id).filter((x): x is number => x != null));
  assert.equal(new Set(ids).size, ids.length);
});

test('les envies passent devant : la culture est choisie avant la nature', () => {
  const c = [cand('nature', 10), cand('culture', 1), cand('culture', 1), cand('gastronomie', 1)];
  const [day] = buildPlan([D('2026-10-14')], c, { ...base, maxVisits: 1 });
  const visit = day.items.find((i) => i.kind === 'visit')!;
  assert.equal(visit.root, 'culture');
  assert.ok(visit.badges.includes('pour_toi'));
});

test('un lieu fermé ce jour-là est écarté (mardi = 2)', () => {
  const closed = cand('culture', 100, { closed_days: [2] });
  const other = cand('culture', 1);
  const [day] = buildPlan([D('2026-10-13')], [closed, other, cand('gastronomie')], base);
  const ids = day.items.map((i) => i.place?.id);
  assert.ok(!ids.includes(closed.place.id));
  assert.ok(ids.includes(other.place.id));
});

test('lieux retirés par l\'utilisateur : jamais reproposés', () => {
  const p = pool();
  const banned = new Set(p.slice(0, 4).map((c) => c.place.id));
  const days = buildPlan([D('2026-10-14'), D('2026-10-15')], p, { ...base, excluded: banned });
  const ids = days.flatMap((d) => d.items.map((i) => i.place?.id));
  for (const b of banned) assert.ok(!ids.includes(b));
});

test('budget d\'activités : les visites trop chères pour le groupe sont écartées', () => {
  const pricey = cand('culture', 100, { price_amount: 60 });     // 120 € pour 2
  const cheap = cand('culture', 1, { price_amount: 5 });
  const [day] = buildPlan([D('2026-10-14')], [pricey, cheap, cand('gastronomie')], { ...base, activityBudgetPerDay: 50 });
  const ids = day.items.map((i) => i.place?.id);
  assert.ok(!ids.includes(pricey.place.id));
  assert.ok(ids.includes(cheap.place.id));
  assert.ok(dayCost(day, 2) <= 50);
});

test('ville sans lieux : jour vide signalé, pas de faux programme', () => {
  const [day] = buildPlan([D('2026-10-14', 2)], pool(), base);
  assert.equal(day.empty, true);
  assert.equal(day.items.length, 0);
});

test('changement de ville sans nom ni coordonnées connus : arrivée l\'après-midi, lieux de la nouvelle ville', () => {
  const two = [...pool(), cand('culture', 9, {}, 2), cand('culture', 8, {}, 2), cand('gastronomie', 5, {}, 2)];
  const days = buildPlan([D('2026-10-13', 1), D('2026-10-14', 1), D('2026-10-15', 2)], two, base);
  assert.equal(days[2].transfer, true);
  assert.equal(days[2].items[0].kind, 'arrival');
  assert.ok(days[2].items.every((i) => !i.place || two.find((c) => c.place.id === i.place!.id)!.cityId === 2));
});

test('jour sans ville : reprend celle de la veille', () => {
  const days = buildPlan([D('2026-10-13', 1), D('2026-10-14', null)], pool(), base);
  assert.equal(days[1].cityId, 1);
  assert.equal(days[1].transfer, false);
});

test('sans lieu de restauration : repas libres « Déjeuner » et « Dîner »', () => {
  const [day] = buildPlan([D('2026-10-14')], [cand('culture', 3), cand('culture', 2)], base);
  const meals = day.items.filter((i) => i.kind === 'lunch' || i.kind === 'dinner');
  assert.deepEqual(meals.map((m) => m.title), ['Déjeuner', 'Dîner']);
  assert.ok(meals.every((m) => m.place === null));
});

test('résultat identique à chaque appel', () => {
  const p = pool();
  const a = JSON.stringify(buildPlan([D('2026-10-13'), D('2026-10-14')], p, base));
  const b = JSON.stringify(buildPlan([D('2026-10-13'), D('2026-10-14')], p, base));
  assert.equal(a, b);
});

test('ranger les horaires : enchaîne les étapes sans heure, garde celles qui en ont, pause déjeuner', () => {
  const mk = (id: string, position: number, startTime: string | null = null, root: string | null = 'culture', dur = 90) => ({ id, place: place({ lat: 38.7, lng: -9.14 }), root, startTime, durationMin: dur, position });
  const res = organizeTimes([mk('a', 1), mk('b', 2), mk('c', 3, '18:00'), mk('d', 4)]);
  const t = Object.fromEntries(res.map((r) => [r.id, r.startMin]));
  assert.equal(t.a, DAY_START);
  assert.ok(t.b > t.a + 90 - 1);
  assert.equal(t.c, undefined);                       // déjà horodatée : non modifiée
  assert.ok(t.d >= 18 * 60 + 90);                     // après l'étape de 18 h
});

test('ranger les horaires : aucune étape sans heure, rien à modifier', () => {
  assert.deepEqual(organizeTimes([{ id: 'x', place: null, root: null, startTime: '10:00', durationMin: 60, position: 1 }]), []);
});

test('les étapes d’arrivée sont reconnues (on ne peut pas les retirer)', async () => {
  const { isArrivalStep } = await import('./itinerary.ts');
  assert.equal(isArrivalStep({ place_id: null, title: 'Arrivée et installation' }), true);
  assert.equal(isArrivalStep({ place_id: null, title: 'Arrivée dans la ville' }), true);
  assert.equal(isArrivalStep({ place_id: null, title: 'Déjeuner' }), false);
  assert.equal(isArrivalStep({ place_id: 12, title: 'Arrivée dans la ville' }), false);
});

test('journée de quartier : visites et repas autour du quartier, sinon toute la ville', () => {
  const far = { lat: 38.75, lng: -9.2 };
  const pool2 = [
    ...Array.from({ length: 4 }, (_, i) => cand('culture', 10 - i)),            // centre (38.70x)
    ...Array.from({ length: 3 }, (_, i) => cand('nature', 2 - i * 0.1, far)),  // quartier, moins populaires
    cand('gastronomie', 1, far), cand('gastronomie', 5),
  ];
  const focus = { name: 'Belém', ...far };
  const [, day] = buildPlan([D('2026-10-13'), { date: '2026-10-14', cityId: 1, focus }], pool2, base);
  assert.equal(day.focus, 'Belém');
  const placed = day.items.filter((i) => i.place);
  assert.ok(placed.length >= 3);
  assert.ok(placed.every((i) => i.place!.lat === far.lat), 'tout est pris dans le quartier');
  // Moins de deux visites possibles autour : journée normale dans toute la ville
  const [, normal] = buildPlan([D('2026-10-13'), { date: '2026-10-14', cityId: 1, focus: { name: 'Vide', lat: 10, lng: 10 } }], pool(), base);
  assert.equal(normal.focus, undefined);
  assert.ok(normal.items.some((i) => i.kind === 'visit'));
});

// Lieux placés à la main : Porto et Lisbonne (274 km), un hôtel, des lieux au nord ou au sud de lui.
const C = (cityId: number, root: string, lat: number, lng: number, pop = 1, over: Partial<Place> = {}): Candidate => cand(root, pop, { lat, lng, ...over }, cityId);
const PORTO = { lat: 41.1496, lng: -8.611 };
const LISBOA = { lat: 38.7223, lng: -9.1393 };
const cities = new Map([[1, { name: 'Porto', ...PORTO }], [2, { name: 'Lisbonne', ...LISBOA }]]);
const around = (cityId: number, c: LatLng) => [
  ...[1, 2, 3, 4, 5].map((k) => C(cityId, 'culture', c.lat + 0.002 * k, c.lng, 10 - k)),
  ...[1, 2, 3, 4].map((k) => C(cityId, 'gastronomie', c.lat - 0.002 * k, c.lng, 5 - k)),
];
const twoCities = () => [...around(1, PORTO), ...around(2, LISBOA)];
const hotel = { name: 'Hôtel', lat: 38.7, lng: -9.14 };

test('trajet entre villes : mode et durée estimés selon la distance', () => {
  const sintra = estimateTransfer(LISBOA, { lat: 38.8, lng: -9.38 });
  assert.equal(sintra.mode, 'car');
  assert.ok(sintra.minutes >= 30 && sintra.minutes <= 60, `${sintra.minutes} min`);
  const train = estimateTransfer(PORTO, LISBOA);
  assert.equal(train.mode, 'train');
  assert.ok(train.minutes >= 150 && train.minutes <= 210, `${train.minutes} min`);
  const plane = estimateTransfer({ lat: 48.8566, lng: 2.3522 }, LISBOA);
  assert.equal(plane.mode, 'plane');
  assert.ok(plane.minutes >= 240 && plane.minutes <= 330, `${plane.minutes} min`);
});

test('changement de ville : trajet à 9 h selon la distance, arrivée à la fin du trajet, la journée suit', () => {
  const days = buildPlan([D('2026-10-13', 1), D('2026-10-14', 1), D('2026-10-15', 2)], twoCities(), { ...base, cities });
  const [trip, arrival, ...rest] = days[2].items;
  assert.equal(trip.kind, 'transfer');
  assert.equal(trip.title, 'Trajet Porto → Lisbonne');
  assert.equal(isFixedStep({ place_id: null, title: trip.title }), true);
  assert.equal(trip.startMin, TRANSFER_DEPART);
  assert.equal(trip.root, 'gare');
  assert.match(trip.note ?? '', /^Train, environ 2 h \d\d \(estimation, 274 km\)$/);
  assert.equal(arrival.kind, 'arrival');
  assert.equal(arrival.title, 'Arrivée et installation');
  assert.equal(arrival.startMin, trip.startMin + trip.durationMin);
  assert.ok(rest.every((i) => i.startMin >= arrival.startMin + arrival.durationMin), 'tout se passe après l\'arrivée');
  assert.ok(rest.some((i) => i.kind === 'lunch'), 'arrivée avant midi : déjeuner sur place');
  assert.ok(rest.every((i) => !i.place || i.place.lat < 40), 'lieux de Lisbonne');
  assert.ok(days[1].items.every((i) => i.kind !== 'transfer' && i.kind !== 'arrival'), 'même ville que la veille : pas de trajet');
});

test('premier jour : trajet depuis la ville de départ si elle est connue, sinon arrivée vers 14 h', () => {
  const [fromHome] = buildPlan([D('2026-10-14', 2)], twoCities(), { ...base, cities, home: { name: 'Paris', lat: 48.8566, lng: 2.3522 } });
  assert.equal(fromHome.items[0].title, 'Trajet Paris → Lisbonne');
  assert.equal(fromHome.items[0].root, 'aeroport');
  assert.equal(fromHome.items[1].kind, 'arrival');
  const [noHome] = buildPlan([D('2026-10-14', 2)], twoCities(), { ...base, cities });
  assert.equal(noHome.items[0].kind, 'arrival');
  assert.equal(noHome.items[0].startMin, ARRIVAL - 30);
});

test('hôtel du soir dans une autre ville : visites, trajet pour arriver vers 18 h, dîner près du nouvel hôtel, lendemain sans trajet', () => {
  const alfama = { name: 'Hôtel Alfama', lat: 38.7115, lng: -9.13 };
  const days = buildPlan([D('2026-10-13', 1), { date: '2026-10-14', cityId: 1, stay: alfama }, { date: '2026-10-15', cityId: 2, stay: alfama }], twoCities(), { ...base, cities });
  const d = days[1];
  const trip = d.items.find((i) => i.kind === 'transfer')!;
  assert.equal(trip.title, 'Trajet Porto → Lisbonne');
  assert.equal(trip.startMin + trip.durationMin, 18 * 60);
  const arrival = d.items.find((i) => i.kind === 'arrival')!;
  assert.equal(arrival.startMin, 18 * 60);
  assert.equal(arrival.note, 'Hôtel Alfama : on dépose les bagages');
  assert.ok(d.items.some((i) => i.kind === 'visit'));
  assert.ok(d.items.filter((i) => i.kind === 'visit' || i.kind === 'lunch').every((v) => v.startMin + v.durationMin <= trip.startMin), 'visites et déjeuner avant le départ');
  const dinner = d.items.find((i) => i.kind === 'dinner')!;
  assert.ok(dinner.place && dinner.place.lat < 40, 'dîner à Lisbonne');
  assert.ok(dinner.startMin >= 20 * 60);
  assert.ok(days[2].items.every((i) => i.kind !== 'transfer' && i.kind !== 'arrival'), 'le lendemain part de l\'hôtel, déjà à Lisbonne');
  assert.equal(days[2].items[0].startMin, DAY_START);
});

test('boucle : les activités les plus proches de l\'hébergement, dans l\'ordre qui fait le moins de trajets', () => {
  const north = [C(1, 'culture', 38.709, -9.14, 5), C(1, 'culture', 38.711, -9.14, 5)];
  const south = C(1, 'culture', 38.691, -9.14, 5);
  const far = [C(1, 'culture', 38.77, -9.14, 5), C(1, 'culture', 38.772, -9.14, 5)];
  const days = buildPlan([{ date: '2026-10-13', cityId: 1, stay: hotel, fixed: true }, { date: '2026-10-14', cityId: 1, stay: hotel }], [...far, south, ...north], base);
  assert.deepEqual(days[0].items, [], 'jour déjà programmé : rien de proposé');
  const visits = days[1].items.filter((i) => i.kind === 'visit').map((i) => i.place!.id);
  assert.deepEqual([...visits].sort(), [south, ...north].map((c) => c.place.id).sort(), 'les lieux à 8 km attendent');
  const n = visits.map((id) => north.some((c) => c.place.id === id));
  assert.ok(n.join() !== 'true,false,true', 'pas d\'aller-retour nord / sud / nord');
});

test('chaque activité à son moment : shopping après 10 h, bien-être l\'après-midi, horaires d\'ouverture respectés', () => {
  const shop = C(1, 'shopping', 38.701, -9.14, 10);
  const spa = C(1, 'bienetre', 38.702, -9.14, 10);
  const museum = C(1, 'culture', 38.703, -9.14, 10, { opening_hours: 'Mo-Su 11:00-17:00', visit_duration_min: 120 });
  const mondayOff = C(1, 'culture', 38.7005, -9.14, 50, { opening_hours: 'Tu-Su 09:00-18:00; Mo off' });
  const [, day] = buildPlan([{ date: '2026-10-11', cityId: 1, stay: hotel, fixed: true }, { date: '2026-10-12', cityId: 1, stay: hotel }],
    [shop, spa, museum, mondayOff, C(1, 'gastronomie', 38.7004, -9.14)], { ...base, interests: ['shopping', 'bienetre', 'culture'] });
  const at = (c: Candidate) => day.items.find((i) => i.place?.id === c.place.id);
  assert.equal(at(mondayOff), undefined, 'fermé le lundi d\'après ses horaires');
  assert.ok(at(shop)!.startMin >= 10 * 60);
  assert.ok(at(spa)!.startMin >= 14 * 60);
  assert.ok(at(museum)!.startMin >= 11 * 60 && at(museum)!.startMin + 120 <= 17 * 60);
  for (let i = 1; i < day.items.length; i++) assert.ok(day.items[i].startMin >= day.items[i - 1].startMin + day.items[i - 1].durationMin, `chevauchement à l'étape ${i}`);
});
