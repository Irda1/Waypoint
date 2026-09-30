import test from 'node:test';
import assert from 'node:assert/strict';
import { moveToIndex, swapWithNeighbor } from './reorder.ts';

const it = (id: string, start_time: string | null, position: number) => ({ id, start_time, position });

test('monter une étape : elle prend l\'heure et le rang de la précédente, et inversement', () => {
  const list = [it('a', '09:00', 1), it('b', '11:00', 2), it('c', null, 3)];
  assert.deepEqual(swapWithNeighbor(list, 1, -1), [
    { id: 'b', start_time: '09:00', position: 1 },
    { id: 'a', start_time: '11:00', position: 2 },
  ]);
});

test('descendre une étape sans heure', () => {
  const list = [it('a', null, 1), it('b', null, 2)];
  assert.deepEqual(swapWithNeighbor(list, 0, 1), [
    { id: 'a', start_time: null, position: 2 },
    { id: 'b', start_time: null, position: 1 },
  ]);
});

test('rangs identiques : l\'étape déplacée passe quand même de l\'autre côté', () => {
  const list = [it('a', null, 0), it('b', null, 0)];
  const [moved, other] = swapWithNeighbor(list, 1, -1);
  assert.ok(moved.position < other.position, 'b passe avant a');
});

test('aux extrémités : rien à faire', () => {
  const list = [it('a', null, 1), it('b', null, 2)];
  assert.deepEqual(swapWithNeighbor(list, 0, -1), []);
  assert.deepEqual(swapWithNeighbor(list, 1, 1), []);
});

test('glisser-déposer : l\'étape prend la place visée, les créneaux restent en place', () => {
  const list = [it('a', '09:00', 1), it('b', '11:00', 2), it('c', null, 3)];
  assert.deepEqual(moveToIndex(list, 2, 0), [
    { id: 'c', start_time: '09:00', position: 1 },
    { id: 'a', start_time: '11:00', position: 2 },
    { id: 'b', start_time: null, position: 3 },
  ]);
  assert.deepEqual(moveToIndex(list, 0, 0), []);
  assert.deepEqual(moveToIndex(list, 0, 5), []);
});

test('glisser-déposer : rangs identiques, renumérotés', () => {
  const list = [it('a', null, 0), it('b', null, 0)];
  assert.deepEqual(moveToIndex(list, 1, 0), [
    { id: 'b', start_time: null, position: 1 },
    { id: 'a', start_time: null, position: 2 },
  ]);
});
