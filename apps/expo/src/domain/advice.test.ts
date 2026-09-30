import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayTips } from './advice.ts';
import type { AdviceInput, AdviceStop } from './advice.ts';
import type { DayWeather } from './weather.ts';

const stop = (over: Partial<AdviceStop> = {}): AdviceStop => ({ name: 'Lieu', root: 'culture', startMin: null, endMin: null, durationMin: 60, travelMin: 0, ...over });
const money = (n: number) => `${Math.round(n)} €`;
const base = (over: Partial<AdviceInput> = {}): AdviceInput => ({ stops: [stop()], weather: null, dayCost: 0, dailyActivityBudget: null, formatMoney: money, ...over });
const sunny = (max: number, rainFrom: number | null = null): DayWeather => ({ day: { date: '2026-10-13', code: 0, max, min: max - 8, rainProb: 5 }, rainFrom, rainTo: rainFrom, advice: null });
const ids = (i: AdviceInput) => dayTips(i).map((t) => t.id);

test('journée vide : propose le programme automatique, rien d\'autre', () => {
  assert.deepEqual(ids(base({ stops: [] })), ['empty']);
});

test('journée calme : aucun conseil', () => {
  assert.deepEqual(ids(base({ stops: [stop(), stop({ travelMin: 10 })] })), []);
});

test('journée chargée : à partir de 10 h avec les trajets', () => {
  const stops = [stop({ durationMin: 240 }), stop({ durationMin: 240, travelMin: 30 }), stop({ durationMin: 60, travelMin: 30 })];
  assert.ok(ids(base({ stops })).includes('busy'));
  assert.ok(!ids(base({ stops: [stop({ durationMin: 200 })] })).includes('busy'));
});

test('trajets lourds : 1 h 30 et plus', () => {
  assert.ok(ids(base({ stops: [stop(), stop({ travelMin: 50 }), stop({ travelMin: 40 })] })).includes('travel'));
  assert.ok(!ids(base({ stops: [stop(), stop({ travelMin: 40 })] })).includes('travel'));
});

test('repas : conseillé à partir de 3 étapes sans gastronomie', () => {
  assert.ok(ids(base({ stops: [stop(), stop(), stop()] })).includes('meal'));
  assert.ok(!ids(base({ stops: [stop(), stop({ root: 'gastronomie' }), stop()] })).includes('meal'));
  assert.ok(!ids(base({ stops: [stop(), stop()] })).includes('meal'));
});

test('créneau libre : seulement avec des heures connues, trajet déduit', () => {
  const stops = [stop({ name: 'A', startMin: 540, endMin: 600 }), stop({ name: 'B', startMin: 780, endMin: 840, travelMin: 20 })];
  const tip = dayTips(base({ stops })).find((t) => t.id === 'free');
  assert.match(tip!.text, /2 h 40 entre A et B/);
  const close = [stop({ startMin: 540, endMin: 600 }), stop({ startMin: 660, endMin: 720, travelMin: 20 })];
  assert.ok(!ids(base({ stops: close })).includes('free'));
  assert.ok(!ids(base({ stops: [stop(), stop()] })).includes('free'));
});

test('beau temps : conseille le plein air seulement s\'il n\'y en a pas déjà et sans pluie', () => {
  const stops = [stop(), stop()];
  assert.ok(ids(base({ stops, weather: sunny(22) })).includes('sun'));
  assert.ok(!ids(base({ stops: [stop({ root: 'nature' }), stop()], weather: sunny(22) })).includes('sun'));
  assert.ok(!ids(base({ stops, weather: sunny(22, 15) })).includes('sun'));
  assert.ok(!ids(base({ stops, weather: sunny(35) })).includes('sun'));
});

test('budget : au-dessus d\'une fois et demie la moyenne prévue', () => {
  const tip = dayTips(base({ dayCost: 90, dailyActivityBudget: 50 })).find((t) => t.id === 'budget');
  assert.match(tip!.text, /90 €.*50 € par jour/);
  assert.ok(!ids(base({ dayCost: 70, dailyActivityBudget: 50 })).includes('budget'));
  assert.ok(!ids(base({ dayCost: 500, dailyActivityBudget: null })).includes('budget'));
});

test('trois conseils au plus', () => {
  const stops = [stop({ durationMin: 300 }), stop({ durationMin: 300, travelMin: 60 }), stop({ travelMin: 60 })];
  const i = base({ stops, weather: sunny(22), dayCost: 100, dailyActivityBudget: 10 });
  assert.equal(dayTips(i).length, 3);
});
