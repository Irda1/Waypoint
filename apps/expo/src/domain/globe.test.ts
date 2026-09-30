import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globeHtml } from './globe.ts';

test('public/globe.html est à jour avec le générateur', () => {
  const file = readFileSync(new URL('../../public/globe.html', import.meta.url), 'utf8');
  assert.equal(file, globeHtml());
});

test('la page du globe contient un script valide', () => {
  const scripts = [...globeHtml().matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  assert.doesNotThrow(() => new Function(scripts[scripts.length - 1][1]));
});
