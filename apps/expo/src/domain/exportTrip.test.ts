import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, exportEntries, frenchDate, programText } from './exportTrip.ts';
import type { ExportInput } from './exportTrip.ts';

const input: ExportInput = {
  title: 'Lisbonne, été',
  days: [{ id: 'd2', day_date: '2026-10-31' }, { id: 'd1', day_date: '2026-10-30' }],
  items: [
    { id: 'a', day_id: 'd1', plan: 'A', title: null, place_id: 1, start_time: '10:00:00', duration_min: 90, position: 1 },
    { id: 'b', day_id: 'd1', plan: 'B', title: 'Plan B', place_id: null, start_time: null, duration_min: null, position: 2 },
    { id: 'c', day_id: 'd1', plan: 'A', title: 'Dîner; fado', place_id: null, start_time: '23:00:00', duration_min: 120, position: 3 },
    { id: 'd', day_id: 'd2', plan: 'A', title: 'Marché', place_id: null, start_time: null, duration_min: null, position: 1 },
  ],
  placeName: (id) => (id === 1 ? 'Tour de Belém' : undefined),
  placeAddress: (id) => (id === 1 ? 'Av. Brasília, Lisboa' : undefined),
};

test('les étapes du plan A sont triées par date puis position, le plan B est écarté', () => {
  const e = exportEntries(input);
  assert.deepEqual(e.map((x) => x.title), ['Tour de Belém', 'Dîner; fado', 'Marché']);
  assert.equal(e[0].start, '10:00');
});

test('date en français', () => { assert.equal(frenchDate('2026-10-30'), 'vendredi 30 octobre'); });

test('texte : jours dans l\'ordre, heures affichées', () => {
  const t = programText(input);
  assert.ok(t.indexOf('vendredi 30 octobre') < t.indexOf('samedi 31 octobre'));
  assert.match(t, /10:00 {2}Tour de Belém/);
  assert.match(t, /Marché/);
});

test('ics : événements horaires, journée entière, échappements et fin après minuit', () => {
  const ics = buildIcs(input, new Date('2026-09-30T12:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART:20261030T100000\r\nDTEND:20261030T113000/);
  assert.match(ics, /SUMMARY:Dîner\; fado/);
  assert.match(ics, /DTSTART:20261030T230000\r\nDTEND:20261031T010000/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101/);
  assert.match(ics, /LOCATION:Av\. Brasília\\, Lisboa/);
  assert.match(ics, /X-WR-CALNAME:Lisbonne\\, été/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 3);
});

test('ics : les lignes longues sont repliées à 75 caractères', () => {
  const long = { ...input, items: [{ ...input.items[3], title: 'x'.repeat(200) }] };
  const lines = buildIcs(long).split('\r\n');
  assert.ok(lines.every((l) => l.length <= 75));
});
