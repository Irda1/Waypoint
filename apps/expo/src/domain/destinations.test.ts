import test from 'node:test';
import assert from 'node:assert/strict';
import { addCity, dayCities, moveCity, nightDetail, removeCity, shiftNights, totalNights } from './destinations.ts';

const d = (id: number, nights: number) => ({ id, name: `V${id}`, nights });
const next = (iso: string) => `${iso.slice(0, 8)}${String(Number(iso.slice(8)) + 1).padStart(2, '0')}`;

test('nuits d\'un voyage : un jour de moins que de jours', () => {
  assert.equal(totalNights(4), 3);
  assert.equal(totalNights(1), 1);
});

test('ajouter puis retirer une ville répartit les nuits', () => {
  const two = addCity([d(1, 6)], { id: 2, name: 'V2' }, 6);
  assert.deepEqual(two.map((c) => c.nights), [3, 3]);
  assert.deepEqual(removeCity(two, 1, 6).map((c) => [c.id, c.nights]), [[2, 6]]);
  assert.equal(addCity(two, { id: 2, name: 'V2' }, 6), two);
});

test('déplacer une ville garde ses nuits', () => {
  const list = [d(1, 2), d(2, 3), d(3, 1)];
  assert.deepEqual(moveCity(list, 2, 0).map((c) => [c.id, c.nights]), [[3, 1], [1, 2], [2, 3]]);
  assert.equal(moveCity(list, 0, 0), list);
});

test('+1 nuit prend une nuit à une autre ville', () => {
  const list = shiftNights([d(1, 3), d(2, 2)], 1, 1);
  assert.deepEqual(list.map((c) => c.nights), [2, 3]);
});

test('détail des nuits et jours par ville', () => {
  const dests = [d(1, 2), d(2, 1)];
  const dates = ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
  const detail = nightDetail(dests, dates, next);
  assert.deepEqual(detail[0].nights, [{ from: '2026-10-13', to: '2026-10-14' }, { from: '2026-10-14', to: '2026-10-15' }]);
  assert.deepEqual(detail[1].nights, [{ from: '2026-10-15', to: '2026-10-16' }]);
  const days = dayCities(dests, ['a', 'b', 'c', 'd']);
  assert.deepEqual(days.get(1), ['a', 'b']);
  assert.deepEqual(days.get(2), ['c', 'd']);
});
