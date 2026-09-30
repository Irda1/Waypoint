import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftToRow, emptyDraft, sortBookings, validateDraft } from './bookings.ts';
import type { Booking } from './bookings.ts';

const b = (id: string, title: string, starts_on: string | null, start_time: string | null = null): Booking => ({ id, kind: 'vol', title, reference: null, starts_on, start_time, url: null, notes: null });

test('tri : par date, puis heure, sans date en dernier', () => {
  const out = sortBookings([b('1', 'Sans date', null), b('2', 'B', '2026-10-31', '09:00'), b('3', 'A', '2026-10-30', '18:00'), b('4', 'C', '2026-10-31', '08:00')]);
  assert.deepEqual(out.map((x) => x.id), ['3', '4', '2', '1']);
});

test('validation : titre, date, heure, lien', () => {
  const ok = { ...emptyDraft(), title: 'Vol' };
  assert.equal(validateDraft(ok), null);
  assert.match(validateDraft({ ...ok, title: ' ' })!, /titre/);
  assert.match(validateDraft({ ...ok, starts_on: '30/10/2026' })!, /AAAA-MM-JJ/);
  assert.match(validateDraft({ ...ok, start_time: '25:00' })!, /HH:MM/);
  assert.match(validateDraft({ ...ok, url: 'billet.pdf' })!, /http/);
  assert.equal(validateDraft({ ...ok, starts_on: '2026-10-30', start_time: '14:35', url: 'https://x.fr/a' }), null);
});

test('ligne de base : vides → null, textes nettoyés', () => {
  const row = draftToRow({ ...emptyDraft(), title: '  Vol  ', reference: ' AB12 ' });
  assert.deepEqual(row, { kind: 'vol', title: 'Vol', reference: 'AB12', starts_on: null, start_time: null, url: null, notes: null });
});
