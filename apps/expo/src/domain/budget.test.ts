import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBalances, settlements, paymentState, budgetSummary, posteForCategory, toCents } from './budget.ts';

// Jeu d'essai de la maquette : 3 amis, 7 dépenses (Lisbonne / Porto)
const exp = (amount: number, paid_by: string | null, extra: object = {}) => ({ amount, paid_by, ...extra });

test('soldes : parts égales, somme des soldes nulle, centimes répartis', () => {
  const expenses = [exp(390, 'a'), exp(105, 'l'), exp(75, 'l'), exp(138, 'm'), exp(74, 'a'), exp(60, 'm'), exp(30, 'l')];
  const b = computeBalances(expenses, ['a', 'l', 'm']);
  const total = expenses.reduce((s, e) => s + e.amount, 0);                      // 872
  assert.equal(b.reduce((s, x) => s + x.share, 0), total, 'la somme des parts = le total');
  assert.equal(Math.round(b.reduce((s, x) => s + x.balance, 0) * 100), 0, 'la somme des soldes est nulle');
  const a = b.find((x) => x.userId === 'a')!;
  assert.equal(a.paid, 464);
  assert.ok(a.balance > 0, 'Adrien a avancé plus que sa part');
});

test('soldes : 10 € entre 3 personnes = 3,34 / 3,33 / 3,33, jamais 9,99', () => {
  const b = computeBalances([exp(10, 'a')], ['a', 'b', 'c']);
  assert.deepEqual(b.map((x) => x.share), [3.34, 3.33, 3.33]);
  assert.equal(b.reduce((s, x) => s + toCents(x.share), 0), 1000);
});

test('soldes : une dépense d\'un ancien membre reste comptée à son nom', () => {
  const b = computeBalances([exp(100, 'parti'), exp(50, 'a')], ['a', 'b']);
  assert.equal(b.find((x) => x.userId === 'parti')!.balance, 100);
  assert.equal(b.find((x) => x.userId === 'a')!.share, 75);
  assert.equal(b.find((x) => x.userId === 'b')!.balance, -75);
});

test('soldes : sans dépense ni membre, aucun calcul absurde', () => {
  assert.deepEqual(computeBalances([], ['a', 'b']).map((x) => x.balance), [0, 0]);
  assert.deepEqual(computeBalances([], []), []);
});

test('virements : soldent exactement tous les comptes', () => {
  const b = computeBalances([exp(300, 'a'), exp(30, 'b')], ['a', 'b', 'c']);
  const t = settlements(b);
  const net = new Map(b.map((x) => [x.userId, toCents(x.balance)]));
  for (const tr of t) {
    net.set(tr.from, net.get(tr.from)! + toCents(tr.amount));
    net.set(tr.to, net.get(tr.to)! - toCents(tr.amount));
  }
  assert.ok([...net.values()].every((v) => v === 0), 'plus rien à régler après les virements');
  assert.ok(t.length <= 2, 'au plus n-1 virements');
  assert.ok(t.every((x) => x.amount > 0 && x.from !== x.to));
});

test('virements : comptes équilibrés = aucun virement', () => {
  assert.deepEqual(settlements(computeBalances([exp(10, 'a'), exp(10, 'b')], ['a', 'b'])), []);
});

test('pastille de paiement : payé / acompte / pas payé / gratuit', () => {
  const item = { id: 'i1', place_id: 1 };
  const place = { price_amount: 35 };
  assert.equal(paymentState(item, place, [], 3), 'unpaid');
  assert.equal(paymentState(item, place, [{ amount: 74, item_id: 'i1' }], 3), 'partial');   // 74 < 105
  assert.equal(paymentState(item, place, [{ amount: 105, item_id: 'i1' }], 3), 'paid');
  assert.equal(paymentState(item, place, [{ amount: 60, item_id: 'i1' }, { amount: 45, item_id: 'i1' }], 3), 'paid', 'plusieurs paiements se cumulent');
  assert.equal(paymentState(item, place, [{ amount: 105, item_id: 'autre' }], 3), 'unpaid', 'un paiement d\'une autre étape ne compte pas');
  assert.equal(paymentState(item, { price_amount: 0 }, [], 3), null);
  assert.equal(paymentState(item, { price_amount: null }, [], 3), null);
  assert.equal(paymentState(item, undefined, [], 3), null);
});

test('catégories -> poste de dépense', () => {
  assert.equal(posteForCategory('gastronomie'), 'repas');
  assert.equal(posteForCategory('restaurant'), 'repas');
  assert.equal(posteForCategory('nocturne'), 'repas');
  assert.equal(posteForCategory('musee'), 'activites');
  assert.equal(posteForCategory(null), 'activites');
});

test('bilan par poste : payé, prévisionnel sans double compte, plan A seulement', () => {
  const places = new Map([
    [1, { price_amount: 35, category_code: 'atelier' }],
    [2, { price_amount: 20, category_code: 'restaurant' }],
    [3, { price_amount: 10, category_code: 'musee' }],
  ]);
  const items = [
    { id: 'i1', place_id: 1, category_code: null, plan: 'A' as const },   // 105 € prévus, 105 payés
    { id: 'i2', place_id: 2, category_code: null, plan: 'A' as const },   // 60 € prévus, acompte 20
    { id: 'i3', place_id: 3, category_code: null, plan: 'B' as const },   // plan B : ignoré
  ];
  const expenses = [
    { amount: 105, poste: 'activites' as const, item_id: 'i1' },
    { amount: 20, poste: 'repas' as const, item_id: 'i2' },
    { amount: 390, poste: 'hebergement' as const, item_id: null },
  ];
  const s = budgetSummary({ expenses, items, places, envelopes: { repas: 450, hebergement: 530 }, travelers: 3 });
  assert.equal(s.activites.paid, 105);
  assert.equal(s.activites.forecast, 0, 'une étape payée n\'est pas comptée deux fois');
  assert.equal(s.repas.paid, 20);
  assert.equal(s.repas.forecast, 40, 'reste après acompte : 60 - 20');
  assert.equal(s.hebergement.paid, 390);
  assert.equal(s.hebergement.envelope, 530);
  assert.equal(s.shopping.paid + s.shopping.forecast, 0);
});

test('revenir sous le budget : retire la plus petite étape qui suffit, sinon les plus chères', async () => {
  const { savingSuggestions, costByDay } = await import('./budget.ts');
  const places = new Map([
    [1, { price_amount: 30, category_code: 'culture', name: 'Musée' }],
    [2, { price_amount: 12, category_code: 'culture', name: 'Tour' }],
    [3, { price_amount: 50, category_code: 'culture', name: 'Château' }],
  ]);
  const items = [
    { id: 'a', day_id: 'd1', place_id: 1, category_code: 'culture', plan: 'A' as const, title: null },
    { id: 'b', day_id: 'd1', place_id: 2, category_code: 'culture', plan: 'A' as const, title: null },
    { id: 'c', day_id: 'd2', place_id: 3, category_code: 'culture', plan: 'A' as const, title: null },
  ];
  // 92 € prévus pour 80 € de budget : dépassement 12 €, la Tour (12 €) suffit exactement.
  const one = savingSuggestions({ expenses: [], items, places, envelopes: { activites: 80 }, travelers: 1 });
  assert.equal(one.length, 1);
  assert.equal(one[0].over, 12);
  assert.deepEqual(one[0].remove.map((r) => r.name), ['Tour']);
  assert.equal(one[0].margin, 0);
  // Dépassement 62 € : aucune étape seule ne suffit → les plus chères d'abord.
  const many = savingSuggestions({ expenses: [], items, places, envelopes: { activites: 30 }, travelers: 1 });
  assert.deepEqual(many[0].remove.map((r) => r.name), ['Château', 'Musée']);
  assert.equal(many[0].margin, 18);
  // Sous le budget : rien à proposer.
  assert.equal(savingSuggestions({ expenses: [], items, places, envelopes: { activites: 200 }, travelers: 1 }).length, 0);
  assert.deepEqual(costByDay([{ id: 'd1' }, { id: 'd2' }], items, places, 2), [84, 100]);
});

test('remboursement reçu : les virements restants diminuent, puis tout est à l\'équilibre', async () => {
  const { applyPayments } = await import('./budget.ts');
  const balances = computeBalances([exp(90, 'a')], ['a', 'b', 'c']);   // a a avancé 90 : b et c lui doivent 30 chacun
  assert.deepEqual(settlements(balances).map((t) => [t.from, t.to, t.amount]), [['b', 'a', 30], ['c', 'a', 30]]);
  const half = applyPayments(balances, [{ from_user: 'b', to_user: 'a', amount: 30 }]);
  assert.deepEqual(settlements(half).map((t) => [t.from, t.to, t.amount]), [['c', 'a', 30]]);
  const done = applyPayments(half, [{ from_user: 'c', to_user: 'a', amount: 30 }]);
  assert.equal(settlements(done).length, 0);
});

test('détail d\'un poste : dépenses saisies puis reste estimé des étapes non payées', async () => {
  const { posteDetail } = await import('./budget.ts');
  const places = new Map([[1, { price_amount: 20, category_code: 'gastronomie', name: 'Time Out' }], [2, { price_amount: 10, category_code: 'culture', name: 'Musée' }]]);
  const items = [
    { id: 'i1', place_id: 1, category_code: null, plan: 'A' as const, title: null },
    { id: 'i2', place_id: 2, category_code: null, plan: 'A' as const, title: null },
    { id: 'i3', place_id: 1, category_code: null, plan: 'B' as const, title: null },
  ];
  const expenses = [
    { amount: 15, poste: 'repas' as const, item_id: 'i1', label: 'Acompte' },
    { amount: 40, poste: 'transports' as const, item_id: null, label: 'Métro' },
  ];
  const repas = posteDetail('repas', { expenses, items, places, travelers: 2 });
  assert.deepEqual(repas, [
    { kind: 'paid', label: 'Acompte', amount: 15 },
    { kind: 'forecast', label: 'Time Out', amount: 25 },   // 20 € × 2 − 15 € déjà payés
  ]);
  assert.deepEqual(posteDetail('activites', { expenses, items, places, travelers: 1 }), [{ kind: 'forecast', label: 'Musée', amount: 10 }]);
});
