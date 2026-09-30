import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayHours, hoursIssues, liveStatus } from './dayhours.ts';
import { scheduleDay } from './planning.ts';
import type { Place, TripItem } from './types.ts';

const place = (id: number, lat: number, lng: number): Place => ({ id, name: `P${id}`, kind: 'activity', category_code: 'culture', lat, lng, price_amount: null, visit_duration_min: 60, closed_days: [] });
const item = (id: string, placeId: number, start: string | null, pos: number): TripItem => ({ id, day_id: 'd', plan: 'A', place_id: placeId, title: null, category_code: null, start_time: start, duration_min: 60, position: pos, done: false });
const places = new Map([[1, place(1, 38.70, -9.13)], [2, place(2, 38.71, -9.14)]]);
const day = (items: TripItem[]) => scheduleDay({ date: '2026-10-13', items, places });

test('heures du jour : défauts 09:30 / 23:30, secondes ignorées', () => {
  assert.deepEqual(dayHours(null, null), { depart: '09:30', return: '23:30', isDefault: true });
  assert.deepEqual(dayHours('08:00:00', '17:30:00'), { depart: '08:00', return: '17:30', isDefault: false });
});

test('retour tardif et départ trop tôt', () => {
  const s = day([item('a', 1, '08:00', 1), item('b', 2, '16:30', 2)]);   // b finit 17:30, + trajet
  const issues = hoursIssues(s, dayHours('09:00', '17:30'), { lat: 38.75, lng: -9.2 });
  assert.equal(issues.find((i) => i.kind === 'early_start')?.minutes, 60);
  const late = issues.find((i) => i.kind === 'late_return');
  assert.ok(late && late.minutes > 0);
  assert.deepEqual(hoursIssues(s, dayHours('07:00', '23:30'), null), []);
  assert.deepEqual(hoursIssues([], dayHours(null, null), null), []);
});

test('journée en cours : étape actuelle, temps restant, prochaine étape', () => {
  const s = day([item('a', 1, '09:30', 1), item('b', 2, '11:00', 2)]);   // a 09:30-10:30, b 11:00-12:00
  const at = (h: number, m: number) => liveStatus(s, h * 60 + m);
  assert.deepEqual(at(9, 45).states, ['current', 'upcoming']);
  assert.equal(at(9, 45).current?.remainingMin, 45);
  assert.equal(at(9, 45).next?.index, 1);
  assert.deepEqual(at(10, 45).states, ['past', 'upcoming']);
  assert.equal(at(10, 45).current, null);
  assert.deepEqual(at(12, 30).states, ['past', 'past']);
  assert.equal(at(12, 30).next, null);
});
