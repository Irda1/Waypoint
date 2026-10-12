import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceText, expensesCsv, finalBalance } from './finalBalance.ts';

const exp = [
  { amount: 300, poste: 'hebergement' as const, paid_by: 'a', label: 'Hôtel', spent_on: '2026-05-12' },
  { amount: 60.5, poste: 'repas' as const, paid_by: 'b', label: 'Dîner; fado', spent_on: '2026-05-13' },
  { amount: 39.5, poste: 'repas' as const, paid_by: 'a', label: '=SOMME(1)', spent_on: '2026-05-12' },
];

test('finalBalance : total, écart, postes, payeurs, comptes', () => {
  const b = finalBalance({ expenses: exp, envelopes: { hebergement: 350, repas: 80 }, budgetTotal: 2000, days: 4, memberIds: ['a', 'b'], payments: [] });
  assert.equal(b.total, 400);
  assert.equal(b.budget, 430);
  assert.equal(b.delta, 30);
  assert.equal(b.perDay, 100);
  assert.equal(b.perPerson, 200);
  assert.deepEqual(b.postes.map((p) => [p.poste, p.paid, p.envelope]), [['hebergement', 300, 350], ['repas', 100, 80]]);
  assert.deepEqual(b.payers, [{ userId: 'a', paid: 339.5 }, { userId: 'b', paid: 60.5 }]);
  assert.equal(b.transfersLeft, 1);
  const settled = finalBalance({ expenses: exp, envelopes: {}, budgetTotal: null, days: 4, memberIds: ['a', 'b'], payments: [{ from_user: 'b', to_user: 'a', amount: 139.5 }] });
  assert.equal(settled.transfersLeft, 0);
  assert.equal(settled.budget, 0);
});

test('balanceText et expensesCsv', () => {
  const b = finalBalance({ expenses: exp, envelopes: {}, budgetTotal: 300, days: 4, memberIds: ['a', 'b'], payments: [] });
  const t = balanceText(b, { title: 'Lisbonne', money: (n) => `${n} €`, name: (id) => id.toUpperCase() });
  assert.match(t, /Total : 400 € \(budget 300 €, 100 € de plus\)/);
  assert.match(t, /A a payé 339.5 €/);
  assert.match(t, /Encore 1 remboursement pour être quittes/);
  const csv = expensesCsv(exp, { currency: 'EUR', name: (id) => (id ?? '?').toUpperCase() }).split('\r\n');
  assert.equal(csv[0], 'Date;Dépense;Poste;Montant;Devise;Payé par');
  assert.equal(csv[1], `2026-05-12;Hôtel;Hébergement;300,00;EUR;A`);
  assert.equal(csv[2], `2026-05-12;"'=SOMME(1)";Repas;39,50;EUR;A`);
  assert.equal(csv[3], `2026-05-13;"Dîner; fado";Repas;60,50;EUR;B`);
});
