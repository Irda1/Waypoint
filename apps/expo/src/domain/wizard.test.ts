import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET_LEVELS, POSTE_SHARES, autoTitle, budgetTotal, changeNights, cityPerDay, dayCount, flexibleDates, missingSteps, newWizard, nightCount, pickDate, pickDuration, pickParty, spreadNights, splitBudget, toggleCity, toggleExcluded, wizardPlan } from './wizard.ts';
import { addDays, diffDays, monthGrid, nextMonths, todayIso } from '../lib/dates.ts';
import { COUNTRIES, POPULAR, COUNTRY_NAME, flagEmoji, searchCountries } from './countries.ts';

const city = (id: number, name = `v${id}`, nights = 0) => ({ id, name, nights });
const sum = (cities: { nights: number }[]) => cities.reduce((s, c) => s + c.nights, 0);

test('dates : ajout de jours, écart et calendrier commençant le lundi', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(diffDays('2026-10-13', '2026-10-18'), 5);
  assert.equal(todayIso(new Date(2026, 9, 5)), '2026-10-05');
  const oct = monthGrid(2026, 9);              // 1er octobre 2026 = jeudi
  assert.equal(oct.blanks, 3);
  assert.equal(oct.days.length, 31);
  assert.equal(oct.days[0], '2026-10-01');
  assert.deepEqual(nextMonths('2026-11-15', 3), [{ year: 2026, month0: 10 }, { year: 2026, month0: 11 }, { year: 2027, month0: 0 }]);
});

test('calendrier : arrivée, départ, jour avant l\'arrivée, puis nouveau choix', () => {
  let s = newWizard();
  s = pickDate(s, '2026-10-13');
  assert.equal(s.start, '2026-10-13'); assert.equal(s.end, null);
  s = pickDate(s, '2026-10-10');               // avant l'arrivée : déplace l'arrivée
  assert.equal(s.start, '2026-10-10'); assert.equal(s.end, null);
  s = pickDate(s, '2026-10-15');
  assert.equal(dayCount(s), 6); assert.equal(nightCount(s), 5);
  s = pickDate(s, '2026-11-01');               // 3e toucher : on recommence
  assert.equal(s.start, '2026-11-01'); assert.equal(s.end, null);
  assert.equal(pickDuration(s, 7).end, '2026-11-07');
});

test('sans dates : durée seule, dates indicatives dans 30 jours', () => {
  const s = flexibleDates(newWizard(), 5, '2026-10-01');
  assert.equal(s.start, '2026-10-31'); assert.equal(s.end, '2026-11-04');
  assert.equal(s.indicative, true); assert.equal(dayCount(s), 5);
});

test('nuits : réparties également, le reste aux premières villes', () => {
  assert.deepEqual(spreadNights([city(1), city(2), city(3)], 7).map((c) => c.nights), [3, 2, 2]);
  assert.deepEqual(spreadNights([city(1), city(2)], 4).map((c) => c.nights), [2, 2]);
  assert.deepEqual(spreadNights([city(1)], 5).map((c) => c.nights), [5]);
});

test('villes : ordre de sélection, plafond d\'une ville par nuit, retrait qui repartit les nuits', () => {
  let r = toggleCity([], { id: 1, name: 'Lisbonne' }, 5);
  r = toggleCity(r.cities, { id: 2, name: 'Porto' }, 5);
  assert.deepEqual(r.cities.map((c) => [c.name, c.nights]), [['Lisbonne', 3], ['Porto', 2]]);
  r = toggleCity(r.cities, { id: 1, name: 'Lisbonne' }, 5);
  assert.deepEqual(r.cities.map((c) => [c.name, c.nights]), [['Porto', 5]]);
  const full = toggleCity([city(1, 'a', 1), city(2, 'b', 1)], { id: 3, name: 'c' }, 2);
  assert.equal(full.cities.length, 2);
  assert.match(full.error ?? '', /au plus 2 villes/);
  assert.equal(toggleCity([], { id: 1, name: 'a' }, 0).error, null);   // aucune nuit : une ville reste possible
});

test('nuits : +/− garde le total et au moins une nuit par ville', () => {
  const start = spreadNights([city(1), city(2), city(3)], 7);           // 3, 2, 2
  const plus = changeNights(start, 1, 1);
  assert.equal(sum(plus), 7);
  assert.deepEqual(plus.map((c) => c.nights), [2, 3, 2]);               // la nuit vient de la ville qui en a le plus
  const moins = changeNights(start, 0, -1);
  assert.equal(sum(moins), 7);
  assert.deepEqual(moins.map((c) => c.nights), [2, 3, 2]);              // la nuit passe à la ville suivante
  const min = spreadNights([city(1), city(2)], 2);                      // 1, 1
  assert.deepEqual(changeNights(min, 0, -1), min);
  assert.deepEqual(changeNights(min, 0, 1), min);
});

test('jours par ville : chacune garde ses nuits, la dernière prend le reste', () => {
  const cities = [city(1, 'a', 2), city(2, 'b', 2)];
  assert.deepEqual(cityPerDay(cities, 5), [1, 1, 2, 2, 2]);
  assert.deepEqual(cityPerDay([], 3), [null, null, null]);
  assert.equal(cityPerDay(cities, 5).length, 5);
});

test('voyageurs : seul et à deux fixent le nombre, amis et famille proposent un départ', () => {
  const s = newWizard();
  assert.equal(pickParty(s, 'seul').travelers, 1);
  assert.equal(pickParty(s, 'deux').travelers, 2);
  assert.equal(pickParty(s, 'amis').travelers, 3);
  assert.equal(pickParty(s, 'famille').travelers, 4);
  assert.equal(pickParty({ ...s, travelers: 6 }, 'amis').travelers, 6);
});

test('budget : niveau × jours × voyageurs, réparti sans perdre un euro', () => {
  let s = { ...newWizard(), start: '2026-10-13', end: '2026-10-18', travelers: 2, budget: { level: 'moyen' as const, amount: null, currency: 'EUR' } };
  assert.equal(budgetTotal(s), 120 * 6 * 2);
  for (const total of [1440, 999, 1, 12345, 100]) {
    const parts = splitBudget(total);
    assert.equal(Object.values(parts).reduce((a, b) => a + b, 0), total, `total ${total}`);
  }
  assert.equal(splitBudget(1000).hebergement, 350);
  assert.equal(Object.keys(POSTE_SHARES).length, 5);
  s = { ...s, budget: { level: 'montant' as never, amount: 1500, currency: 'EUR' } as never };
  assert.equal(budgetTotal(s), 1500);
  assert.equal(budgetTotal({ ...s, budget: { level: 'montant' as never, amount: null, currency: 'EUR' } }), null);
  assert.equal(budgetTotal(newWizard()), null);
  assert.equal(BUDGET_LEVELS.length, 4);
});

test('titre automatique et étapes manquantes', () => {
  assert.equal(autoTitle({ country: 'PT', party: 'amis' }), 'Portugal entre amis');
  assert.equal(autoTitle({ country: 'JP', party: null }), 'Japon');
  assert.equal(autoTitle({ country: null, party: null }), 'Mon voyage');
  assert.deepEqual(missingSteps(newWizard()), ['pays', 'dates', 'voyageurs', 'interets', 'budget']);
  const ready = { ...newWizard(), country: 'PT', start: '2026-10-13', end: '2026-10-16', party: 'seul' as const, interests: ['culture'], budget: { level: 'eco' as never, amount: null, currency: 'EUR' } };
  assert.deepEqual(missingSteps({ ...ready, budget: { level: 'economique', amount: null, currency: 'EUR' } }), []);
});

test('pays : liste de la maquette, recherche sans accents, drapeaux', () => {
  assert.equal(COUNTRIES.length, 199);
  assert.ok(POPULAR.every((p) => COUNTRY_NAME[p.code]));
  assert.equal(searchCountries('bresil')[0]?.code, 'BR');
  assert.equal(searchCountries('  ').length, 199);
  assert.equal(searchCountries('zzz').length, 0);
  assert.equal(flagEmoji('PT'), '🇵🇹');
});

test('propositions : un jour par jour du voyage, lieux retirés écartés, rien sans ville', () => {
  const cands = Array.from({ length: 8 }, (_, i) => ({ place: { id: 100 + i, name: `Lieu ${i}`, kind: 'activity', category_code: 'musee', lat: 38.7 + i * 0.001, lng: -9.14, price_amount: null, visit_duration_min: 60, closed_days: [] } as never, cityId: 1, root: 'culture', popularity: 10 - i }));
  const s = { ...newWizard(), country: 'PT', start: '2026-10-13', end: '2026-10-15', travelers: 2, interests: ['culture'], cities: [{ id: 1, name: 'Lisbonne', nights: 2 }] };
  assert.equal(wizardPlan({ ...s, cities: [] }, cands).length, 0);
  const plan = wizardPlan(s, cands);
  assert.deepEqual(plan.map((d) => d.date), ['2026-10-13', '2026-10-14', '2026-10-15']);
  const first = plan.flatMap((d) => d.items).find((i) => i.place)!.place!.id;
  const s2 = toggleExcluded(s, first);
  assert.deepEqual(s2.excluded, [first]);
  assert.ok(!wizardPlan(s2, cands).flatMap((d) => d.items).some((i) => i.place?.id === first));
  assert.deepEqual(toggleExcluded(s2, first).excluded, []);
});
