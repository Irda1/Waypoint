import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNewDay, suggestNewDay } from './dates.ts';

test('nouveau jour : refusé hors des dates du voyage, accepté dedans ou sans dates', () => {
  assert.equal(checkNewDay('2026-10-14', '2026-10-13', '2026-10-16'), null);
  assert.match(checkNewDay('2026-10-12', '2026-10-13', '2026-10-16')!, /avant le début du voyage/);
  assert.match(checkNewDay('2026-10-18', '2026-10-13', '2026-10-16')!, /après la fin du voyage/);
  assert.equal(checkNewDay('2027-01-01', null, null), null);
});

test('date proposée : lendemain du dernier jour, ou début du voyage, sinon vide', () => {
  assert.equal(suggestNewDay(['2026-10-13', '2026-10-14'], '2026-10-13', '2026-10-16'), '2026-10-15');
  assert.equal(suggestNewDay([], '2026-10-13', '2026-10-16'), '2026-10-13');
  assert.equal(suggestNewDay(['2026-10-16'], '2026-10-13', '2026-10-16'), '');
  assert.equal(suggestNewDay([], null, null), '');
  assert.equal(suggestNewDay(['2026-10-13'], null, null), '2026-10-14');
});
