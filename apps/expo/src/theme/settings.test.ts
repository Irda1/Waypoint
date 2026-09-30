import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_APPEARANCE, parseAppearance, resolveMode } from './settings.ts';

test('mode auto : suit le téléphone, nuit par défaut', () => {
  assert.equal(resolveMode('auto', 'light'), 'jour');
  assert.equal(resolveMode('auto', 'dark'), 'nuit');
  assert.equal(resolveMode('auto', null), 'nuit');
});

test('mode forcé : ignore le téléphone', () => {
  assert.equal(resolveMode('nuit', 'light'), 'nuit');
  assert.equal(resolveMode('jour', 'dark'), 'jour');
});

test('réglage enregistré : valeurs valides relues, le reste retombe sur le défaut', () => {
  assert.deepEqual(parseAppearance('{"mode":"jour","accent":"lavande"}'), { mode: 'jour', accent: 'lavande', icons: 'couleur' });
  assert.equal(parseAppearance('{"icons":"plein"}').icons, 'plein');
  assert.equal(parseAppearance('{"icons":"neon"}').icons, 'couleur');
  assert.deepEqual(parseAppearance('{"mode":"bizarre","accent":"x"}'), DEFAULT_APPEARANCE);
  assert.deepEqual(parseAppearance('pas du json'), DEFAULT_APPEARANCE);
  assert.deepEqual(parseAppearance(null), DEFAULT_APPEARANCE);
});
