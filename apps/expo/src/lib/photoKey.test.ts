import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoKeyFor } from './photoKey.ts';

test('photo : reconnaît Lisbonne, Porto et Alfama, sans tenir compte des accents ni de la casse', () => {
  assert.equal(photoKeyFor('Lisbonne entre amis'), 'lisbonne');
  assert.equal(photoKeyFor('LISBOA 2026'), 'lisbonne');
  assert.equal(photoKeyFor('Week-end à Porto'), 'porto');
  assert.equal(photoKeyFor('Balade dans l\'Alfama'), 'alfama');
});

test('photo : photo d\'horizon par défaut', () => {
  assert.equal(photoKeyFor('Tokyo'), 'horizon');
  assert.equal(photoKeyFor(''), 'horizon');
});
