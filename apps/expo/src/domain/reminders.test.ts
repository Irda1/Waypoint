import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReminders, MAX_REMINDERS } from './reminders.ts';
import type { ReminderInput } from './reminders.ts';

const base: ReminderInput = {
  tripTitle: 'Lisbonne',
  startsOn: '2026-10-30',
  days: [{ id: 'd1', day_date: '2026-10-30' }, { id: 'd2', day_date: '2026-10-31' }],
  items: [
    { id: 'i1', day_id: 'd1', plan: 'A', title: null, place_id: 1, start_time: '10:00:00', position: 2 },
    { id: 'i2', day_id: 'd1', plan: 'A', title: 'Petit-déj', place_id: null, start_time: '09:00:00', position: 1 },
    { id: 'i3', day_id: 'd1', plan: 'B', title: 'Plan B tôt', place_id: null, start_time: '07:00:00', position: 3 },
    { id: 'i4', day_id: 'd2', plan: 'A', title: 'Sans heure', place_id: null, start_time: null, position: 1 },
  ],
  placeName: (id) => (id === 1 ? 'Tour de Belém' : undefined),
};
const now = new Date(2026, 9, 1, 12, 0);

test('veille du départ à 18 h et chaque activité horaire 30 min avant', () => {
  const r = buildReminders(base, now);
  assert.equal(r.length, 3);
  assert.deepEqual(r[0].at, new Date(2026, 9, 29, 18, 0));
  assert.match(r[0].body, /Départ demain/);
  assert.deepEqual(r[1].at, new Date(2026, 9, 30, 8, 30));
  assert.equal(r[1].body, 'Dans 30 min : Petit-déj (09:00)');
  assert.equal(r[2].body, 'Dans 30 min : Tour de Belém (10:00)');
});

test('le plan B et les étapes sans heure ne déclenchent rien', () => {
  const r = buildReminders(base, now);
  assert.ok(!r.some((x) => /Plan B|Sans heure/.test(x.body)));
});

test('délai réglable et rappels coupables un par un', () => {
  const r = buildReminders({ ...base, prefs: { eve: false, bookings: false, next: true, minutes: 60 } }, now);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].at, new Date(2026, 9, 30, 8, 0));
  assert.equal(buildReminders({ ...base, prefs: { eve: true, bookings: false, next: false, minutes: 30 } }, now).length, 1);
});

test('jour J : activités à réserver ou payer, à 8 h', () => {
  const r = buildReminders({ ...base, prefs: { eve: false, bookings: true, next: false, minutes: 30 }, dueByDay: { d1: ['Musée', 'Tour', 'Jardin', 'Café'], d2: [] } }, now);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].at, new Date(2026, 9, 30, 8, 0));
  assert.equal(r[0].body, "Aujourd'hui, à réserver ou payer : Musée, Tour, Jardin et 1 autre");
});

test('rien dans le passé', () => {
  assert.equal(buildReminders(base, new Date(2026, 9, 30, 12, 0)).length, 0);
  assert.equal(buildReminders(base, new Date(2026, 9, 29, 19, 0)).length, 2);
});

test('plafond du nombre de rappels', () => {
  const days = Array.from({ length: 100 }, (_, i) => ({ id: `d${i}`, day_date: new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10) }));
  const items = days.map((d) => ({ day_id: d.id, plan: 'A' as const, title: 'X', place_id: null, start_time: '10:00:00', position: 1 }));
  assert.equal(buildReminders({ ...base, startsOn: null, days, items }, now).length, MAX_REMINDERS);
});
