import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, formatTime, roundUp5, distanceKm, estimateTravel, positionBetween, weekdayOf, scheduleDay, resolveOverlaps } from './planning.ts';
import type { Place, TripItem } from './types.ts';

test('heures : lecture, format, arrondi', () => {
  assert.equal(parseTime('09:30'), 570);
  assert.equal(parseTime('09:30:00'), 570);
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('9h30'), null);
  assert.equal(parseTime(null), null);
  assert.equal(formatTime(570), '09:30');
  assert.equal(formatTime(1500), '01:00', 'passe minuit');
  assert.equal(formatTime(-30), '23:30');
  assert.equal(roundUp5(41), 45);
  assert.equal(roundUp5(45), 45);
});

test('distance : Lisbonne -> Porto ≈ 274 km', () => {
  const d = distanceKm({ lat: 38.7223, lng: -9.1393 }, { lat: 41.1579, lng: -8.6291 });
  assert.ok(d > 270 && d < 278, String(d));
  assert.equal(distanceKm({ lat: 1, lng: 1 }, { lat: 1, lng: 1 }), 0);
});

test('trajet : à pied sous 1,5 km, sinon transports, toujours « estimé »', () => {
  const chiado = { lat: 38.7107, lng: -9.1408 };
  const alfama = { lat: 38.7139, lng: -9.1335 };     // ≈ 0,7 km
  const belem = { lat: 38.6916, lng: -9.2160 };      // ≈ 6 km
  const walk = estimateTravel(chiado, alfama);
  assert.equal(walk.mode, 'walk');
  assert.ok(walk.minutes >= 3 && walk.minutes < 25);
  const transit = estimateTravel(chiado, belem);
  assert.equal(transit.mode, 'transit');
  assert.equal(transit.minutes % 5, 0, 'arrondi aux 5 minutes');
  assert.equal(transit.estimated, true);
  assert.equal(estimateTravel(chiado, chiado).minutes, 3, 'minimum 3 minutes');
});

test('position : glisser entre deux étapes ne modifie qu\'une ligne', () => {
  assert.equal(positionBetween(1, 2), 1.5);
  assert.equal(positionBetween(null, 3), 2);
  assert.equal(positionBetween(3, null), 4);
  assert.equal(positionBetween(null, null), 1);
  assert.ok(positionBetween(1, 1.5) > 1 && positionBetween(1, 1.5) < 1.5);
});

test('jour de la semaine sans piège de fuseau horaire', () => {
  assert.equal(weekdayOf('2026-10-13'), 2);   // mardi
  assert.equal(weekdayOf('2026-10-11'), 0);   // dimanche
});

const place = (id: number, lat: number, lng: number, extra: Partial<Place> = {}): Place => ({
  id, name: `P${id}`, kind: 'activity', category_code: 'musee', lat, lng, price_amount: null, visit_duration_min: 60, closed_days: [], ...extra,
});
const item = (id: string, place_id: number | null, start_time: string | null, extra: Partial<TripItem> = {}): TripItem => ({
  id, day_id: 'd', plan: 'A', place_id, title: place_id == null ? 'Libre' : null, category_code: null, start_time,
  duration_min: null, position: 0, done: false, ...extra,
});

test('journée : tri par heure, fins, trajets, aucune alerte quand tout est cohérent', () => {
  const places = new Map([[1, place(1, 38.7107, -9.1408)], [2, place(2, 38.7139, -9.1335)]]);
  const items = [item('b', 2, '13:00'), item('a', 1, '10:00')];
  const day = scheduleDay({ date: '2026-10-13', items, places });
  assert.deepEqual(day.map((d) => d.item.id), ['a', 'b']);
  assert.equal(day[0].startMin, 600);
  assert.equal(day[0].endMin, 660, 'durée du lieu = 60 min');
  assert.equal(day[0].travelFromPrevious, null);
  assert.equal(day[1].travelFromPrevious?.mode, 'walk');
  assert.deepEqual(day.flatMap((d) => d.issues), []);
});

test('journée : alerte de chevauchement, trajet compris', () => {
  const places = new Map([[1, place(1, 38.7107, -9.1408)], [2, place(2, 38.6916, -9.2160)]]);
  const day = scheduleDay({ date: '2026-10-13', places, items: [item('a', 1, '10:00'), item('b', 2, '11:10')] });
  const overlap = day[1].issues.find((i) => i.type === 'overlap');
  assert.ok(overlap, 'fin à 11:00 + ~30 min de trajet > 11:10');
});

test('journée : lieu fermé ce jour-là, étape sans heure, plans B et C séparés', () => {
  const places = new Map([[1, place(1, 0, 0, { closed_days: [2] })]]);   // fermé le mardi
  const day = scheduleDay({ date: '2026-10-13', places, items: [item('a', 1, '10:00'), item('n', null, null), item('bb', 1, '10:00', { plan: 'B' })] });
  assert.equal(day.length, 2, 'le plan B n\'est pas dans le plan A');
  assert.deepEqual(day[0].issues.map((i) => i.type), ['closed_day']);
  assert.deepEqual(day[1].issues.map((i) => i.type), ['no_time']);
  assert.equal(scheduleDay({ date: '2026-10-13', places, items: [item('bb', 1, '10:00', { plan: 'B' })], plan: 'B' }).length, 1);
  assert.deepEqual(scheduleDay({ date: '2026-10-14', places, items: [item('a', 1, '10:00')] })[0].issues, [], 'ouvert le mercredi');
});

test('chevauchements : les étapes sont décalées en cascade, dans l\'ordre, trajet compris', () => {
  const mk = (id: string, start: string, dur: number): TripItem => ({ id, plan: 'A', position: 1, start_time: start, duration_min: dur, place_id: null, title: id } as unknown as TripItem);
  const sched = scheduleDay({ date: '2026-12-14', items: [mk('a', '09:00', 90), mk('b', '10:00', 60), mk('c', '11:00', 60)], places: new Map() });
  const r = resolveOverlaps(sched);
  assert.deepEqual(r.changes, [{ id: 'b', startMin: 630 }, { id: 'c', startMin: 690 }]);
  assert.equal(r.overflow, false);
  assert.deepEqual(resolveOverlaps(scheduleDay({ date: '2026-12-14', items: [mk('a', '09:00', 60), mk('b', '10:00', 60)], places: new Map() })).changes, [], 'rien à décaler');
  assert.equal(resolveOverlaps(scheduleDay({ date: '2026-12-14', items: [mk('a', '22:00', 120), mk('b', '22:30', 60)], places: new Map() })).overflow, true, 'ne tient pas avant minuit');
});
