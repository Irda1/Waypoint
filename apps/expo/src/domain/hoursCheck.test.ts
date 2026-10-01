import test from 'node:test';
import assert from 'node:assert/strict';
import { tripHoursProblems } from './hoursCheck.ts';
import type { Place, TripItem } from './types.ts';

const day = (id: string, date: string) => ({ id, day_date: date });
const item = (id: string, dayId: string, placeId: number, start: string | null, position = 1): TripItem => ({ id, day_id: dayId, trip_id: 't', plan: 'A', place_id: placeId, title: null, start_time: start, duration_min: 60, position, category_code: null } as unknown as TripItem);
const place = (id: number, name: string, hours: string | null, closed: number[] = []): Place => ({ id, name, lat: 35, lng: 135, opening_hours: hours, closed_days: closed, visit_duration_min: 60 } as unknown as Place);

test('fermé, hors horaires et ok sont distingués', () => {
  // 2026-10-05 = lundi
  const days = [day('d1', '2026-10-05')];
  const places = new Map([[1, place(1, 'Musée', 'Mo off; Tu-Su 10:00-18:00', [1])], [2, place(2, 'Temple', 'Mo-Su 09:00-17:00')], [3, place(3, 'Marché', 'Mo-Su 09:00-17:00')]]);
  const items = [item('a', 'd1', 1, '10:00', 1), item('b', 'd1', 2, '18:00', 2), item('c', 'd1', 3, '12:00', 3)];
  const r = tripHoursProblems({ days, items, places });
  const kinds = new Map(r.problems.filter((p) => p.kind !== 'overlap').map((p) => [p.name, p.kind]));
  assert.equal(kinds.get('Musée'), 'closed');
  assert.equal(kinds.get('Temple'), 'outside');
  assert.equal(kinds.has('Marché'), false);
  assert.equal(r.checked, 3);
});

test('horaires inconnus : compté à part, pas un problème', () => {
  const r = tripHoursProblems({ days: [day('d1', '2026-10-06')], items: [item('a', 'd1', 1, '10:00')], places: new Map([[1, place(1, 'Parc', null)]]) });
  assert.equal(r.problems.length, 0);
  assert.equal(r.unknown, 1);
});

test('chevauchement signalé avec le numéro du jour', () => {
  const places = new Map([[1, place(1, 'A', null)], [2, place(2, 'B', null)]]);
  const r = tripHoursProblems({ days: [day('d1', '2026-10-06'), day('d2', '2026-10-07')], items: [item('a', 'd2', 1, '10:00', 1), item('b', 'd2', 2, '10:30', 2)], places });
  const p = r.problems.find((x) => x.kind === 'overlap');
  assert.equal(p?.dayNumber, 2);
  assert.equal(p?.name, 'B');
});
