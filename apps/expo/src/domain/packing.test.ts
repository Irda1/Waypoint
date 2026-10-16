import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupOf, newIdeas, packFacts, packingIdeas, perPerson } from './packing.ts';
import type { PackContext } from './packing.ts';

const base: PackContext = {
  country: 'PT', currency: 'EUR', nights: 8, party: 'famille', month: 5, lat: 38.7,
  weather: { covered: true, min: 14, max: 24, rainy: [{ city: 'Porto', date: '2027-05-11' }, { city: 'Porto', date: '2027-05-12' }] },
  activities: [{ code: 'parc', name: 'Sintra', date: '2027-05-12' }, { code: 'plage', name: 'Cascais', date: '2027-05-13' }],
};
const labels = (c: PackContext) => packingIdeas(c).map((i) => i.label);

test('perPerson : un par nuit, une lessive au-delà d\'une semaine, 7 au plus', () => {
  assert.equal(perPerson(3), 3);
  assert.equal(perPerson(7), 7);
  assert.equal(perPerson(8), 4);
  assert.equal(perPerson(20), 7);
  assert.equal(perPerson(0), 1);
});

test('Portugal en famille : Europe, pluie, chaleur, enfants, activités, avec leurs raisons', () => {
  const ideas = packingIdeas(base);
  const why = (l: string) => ideas.find((i) => i.label === l)?.why;
  assert.equal(why('Carte d\'identité ou passeport'), 'Europe : la carte d\'identité suffit');
  assert.equal(why('Imperméable ou parapluie'), 'pluie prévue à Porto mardi et 1 autre jour');
  assert.equal(why('Pull ou polaire'), 'soirées à 14 °C');
  assert.equal(why('Crème solaire'), 'jusqu\'à 24 °C');
  assert.equal(why('Chaussures de marche'), 'Sintra mercredi');
  assert.equal(why('Maillot de bain et serviette'), 'Cascais jeudi');
  assert.equal(why('T-shirts · 4 par personne'), '8 nuits, une lessive');
  assert.ok(labels(base).includes('Doudou et jeux pour le trajet'));
  assert.ok(!labels(base).some((l) => l.startsWith('Adaptateur')));
  assert.deepEqual(packFacts(base), ['14 – 24 °C', 'pluie 2 jours', '8 nuits', 'prises : rien à prévoir']);
});

test('Japon en hiver sans prévisions : passeport, adaptateur, espèces, saison', () => {
  const jp: PackContext = { ...base, country: 'JP', currency: 'JPY', party: 'deux', month: 1, lat: 35.7, weather: { covered: false, min: null, max: null, rainy: [] }, activities: [{ code: 'temple', name: 'Kinkaku-ji', date: '2027-01-10' }] };
  const l = labels(jp);
  assert.ok(l.includes('Passeport') && l.includes('Assurance voyage'));
  assert.ok(l.includes('Visit Japan Web (formulaire d\'arrivée)') && l.includes('Formalités d\'entrée vérifiées'));
  assert.ok(l.includes('Adaptateur de prise type A'));
  assert.ok(l.includes('Un peu d\'espèces en JPY'));
  assert.ok(l.includes('Manteau chaud'));
  assert.ok(l.includes('Tenue couvrant épaules et genoux'));
  assert.ok(!l.includes('Doudou et jeux pour le trajet'));
  assert.deepEqual(packFacts(jp), ['8 nuits', 'prises type A : adaptateur', 'JPY']);
});

test('Formalités : démarche connue du pays, vérification hors Europe, rien en Europe', () => {
  const us = packingIdeas({ ...base, country: 'US', currency: 'USD' });
  assert.equal(us.find((i) => i.label === 'ESTA (autorisation de voyage)')?.group, 'Papiers');
  assert.ok(labels({ ...base, country: 'MA', currency: 'MAD' }).includes('Formalités d\'entrée vérifiées'));
  assert.ok(!labels(base).includes('Formalités d\'entrée vérifiées'));
});

test('groupOf et newIdeas : quantité ignorée, écartées et déjà présentes retirées', () => {
  const ideas = packingIdeas(base);
  assert.equal(groupOf('T-shirts · 6 par personne', ideas), 'Vêtements');
  assert.equal(groupOf('Livre pour l\'avion', ideas), 'Autres');
  const left = newIdeas(ideas, ['t-shirts · 3 par personne', 'Crème solaire'], ['Trousse de médicaments']);
  assert.ok(!left.some((i) => i.label.startsWith('T-shirts') || i.label === 'Crème solaire' || i.label === 'Trousse de médicaments'));
  assert.equal(left.length, ideas.length - 3);
});
