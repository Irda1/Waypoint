import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, likeTerm } from './search.ts';

test('recherche : neutralise les jokers et retire les caractères de syntaxe', () => {
  assert.equal(likeTerm('  Time   Out '), 'Time Out');
  assert.equal(likeTerm('100%'), '100\\%');
  assert.equal(likeTerm('a_b'), 'a\\_b');
  assert.equal(likeTerm('café, (bar)*"x"'), 'café bar x');
  assert.equal(likeTerm('   '), '');
});

test('durée lisible', () => {
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(90), '1 h 30');
  assert.equal(formatDuration(120), '2 h');
  assert.equal(formatDuration(65), '1 h 05');
});
