import { test } from 'node:test';
import assert from 'node:assert/strict';
import { palette, contrastRatio, categoryColors } from './tokens.ts';
import type { AccentName, Mode } from './tokens.ts';

const modes: Mode[] = ['nuit', 'jour'];
const accents: AccentName[] = ['soleil', 'turquoise', 'corail', 'lavande'];

test('contraste : texte principal et secondaire ≥ 4,5:1 sur le fond et les cartes (WCAG AA)', () => {
  for (const m of modes) {
    const p = palette(m);
    for (const bg of [p.bg, p.surface, p.surface2]) {
      assert.ok(contrastRatio(p.text, bg) >= 4.5, `${m} texte/${bg}`);
      assert.ok(contrastRatio(p.text2, bg) >= 4.5, `${m} texte secondaire/${bg}`);
    }
    assert.ok(contrastRatio(p.text3, p.bg) >= 4.5, `${m} texte tertiaire`);
  }
});

test('contraste : chaque accent lisible sur le fond, et son texte lisible dessus', () => {
  for (const m of modes) for (const a of accents) {
    const p = palette(m, a);
    assert.ok(contrastRatio(p.accent, p.bg) >= 4.5, `${m}/${a} accent sur fond`);
    assert.ok(contrastRatio(p.onAccent, p.accent) >= 4.5, `${m}/${a} texte sur bouton`);
  }
});

test('contraste : pastille « payé » et couleurs de catégories lisibles', () => {
  for (const m of modes) {
    const p = palette(m);
    assert.ok(contrastRatio(p.onPaid, p.paid) >= 4.5, `${m} dollar sur fond vert`);
    assert.ok(contrastRatio(p.paid, p.bg) >= 3, `${m} vert sur fond (élément graphique ≥ 3:1)`);
    for (const [cat, color] of Object.entries(categoryColors[m])) {
      assert.ok(contrastRatio(color, p.bg) >= 3, `${m}/${cat} ≥ 3:1`);
    }
  }
});
