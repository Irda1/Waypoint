import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReminders, MAX_REMINDERS } from './reminders.ts';
import type { ReminderInput } from './reminders.ts';

const base: ReminderInput = {
  tripTitle: 'Lisbonne',
  startsOn: '2026-10-30',
  days: [{ id: 'd1', day_date: '2026-10-30' }, { id: 'd2', day_date: '2026-10-31' }],
  items: [
    { day_id: 'd1', plan: 'A', title: null, place_id: 1, start_time: '10:00:00', position: 2 },
    { day_id: 'd1', plan: 'A', title: 'Petit-déj', place_id: null, start_time: '09:00:00', position: 1 },
    { day_id: 'd1', plan: 'B', title: 'Plan B tôt', place_id: null, start_time: '07:00:00', position: 3 },
    { day_id: 'd2', plan: 'A', title: 'Sans heure', place_id: null, start_time: null, position: 1 },
  ],
  placeName: (id) => (id === 1 ? 'Tour de Belém' : undefined),
};
const now = new Date(2026, 9, 1, 12, 0);

test('veille du départ à 18 h et première activité horaire 1 h avant', () => {
  const r = buildReminders(base, now);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].at, new Date(2026, 9, 29, 18, 0));
  assert.match(r[0].body, /Départ demain/);
  assert.deepEqual(r[1].at, new Date(2026, 9, 30, 8, 0));
  assert.equal(r[1].body, 'À 09:00 : Petit-déj');
});

test('le plan B et les étapes sans heure ne déclenchent rien', () => {
  const r = buildReminders(base, now);
  assert.ok(!r.some((x) => /Plan B|Sans heure/.test(x.body)));
});

test('le nom vient du lieu quand l\'étape n\'a pas de titre', () => {
  const r = buildReminders({ ...base, items: [base.items[0]] }, now);
  assert.equal(r[1].body, 'À 10:00 : Tour de Belém');
});

test('rien dans le passé', () => {
  assert.equal(buildReminders(base, new Date(2026, 9, 30, 12, 0)).length, 0);
  assert.equal(buildReminders(base, new Date(2026, 9, 29, 19, 0)).length, 1);
});

test('plafond du nombre de rappels', () => {
  const days = Array.from({ length: 100 }, (_, i) => ({ id: `d${i}`, day_date: new Date(Date.UTC(2027, 0, 1 + i)).toISOString().slice(0, 10) }));
  const items = days.map((d) => ({ day_id: d.id, plan: 'A' as const, title: 'X', place_id: null, start_time: '10:00:00', position: 1 }));
  assert.equal(buildReminders({ ...base, startsOn: null, days, items }, now).length, MAX_REMINDERS);
});
