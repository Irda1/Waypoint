import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARRIVAL, DAY_START, buildPlan, dayCost, organizeTimes } from './itinerary.ts';
import type { Candidate } from './itinerary.ts';
import type { Place } from './types.ts';

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

test('changement de ville : la journée repart de l\'après-midi avec les lieux de la nouvelle ville', () => {
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
