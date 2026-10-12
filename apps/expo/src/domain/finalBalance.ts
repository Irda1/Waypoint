// Bilan final du voyage : total, écart au budget, par poste, qui a payé quoi, comptes restants, texte à partager
// et tableau CSV. Fonctions pures, testées sans réseau.
import { POSTES } from './types.ts';
import type { Poste } from './types.ts';
import { applyPayments, computeBalances, fromCents, settlements, toCents } from './budget.ts';
import type { SettlementPayment } from './budget.ts';

export const POSTE_NAMES: Record<Poste, string> = { hebergement: 'Hébergement', transports: 'Transports', repas: 'Repas', activites: 'Activités', shopping: 'Shopping' };

interface ExpenseRow { amount: number; poste: Poste; paid_by: string | null; label?: string | null; spent_on?: string | null }

export interface FinalBalance {
  total: number;
  /** Budget prévu : somme des enveloppes, sinon budget global du voyage ; 0 s'il n'y en a pas. */
  budget: number;
  /** Budget − total : positif = sous le budget. */
  delta: number;
  perDay: number;
  perPerson: number;
  count: number;
  postes: { poste: Poste; paid: number; envelope: number }[];
  payers: { userId: string; paid: number }[];
  /** Remboursements encore à faire pour être quittes. */
  transfersLeft: number;
}

export function finalBalance(a: {
  expenses: ExpenseRow[];
  envelopes: Partial<Record<Poste, number>>;
  budgetTotal: number | null;
  days: number;
  memberIds: string[];
  payments: SettlementPayment[];
}): FinalBalance {
  const totalCents = a.expenses.reduce((s, e) => s + toCents(Number(e.amount) || 0), 0);
  const total = fromCents(totalCents);
  const envelopeSum = POSTES.reduce((s, p) => s + (a.envelopes[p] ?? 0), 0);
  const budget = envelopeSum || Number(a.budgetTotal ?? 0);
  const paidBy = new Map<string, number>();
  for (const e of a.expenses) if (e.paid_by) paidBy.set(e.paid_by, (paidBy.get(e.paid_by) ?? 0) + toCents(Number(e.amount) || 0));
  const people = Math.max(1, a.memberIds.length);
  return {
    total,
    budget,
    delta: Math.round((budget - total) * 100) / 100,
    perDay: Math.round(total / Math.max(1, a.days)),
    perPerson: Math.round(total / people),
    count: a.expenses.length,
    postes: POSTES.map((p) => ({ poste: p, paid: fromCents(a.expenses.filter((e) => e.poste === p).reduce((s, e) => s + toCents(Number(e.amount) || 0), 0)), envelope: a.envelopes[p] ?? 0 }))
      .filter((x) => x.paid > 0 || x.envelope > 0),
    payers: [...paidBy].map(([userId, c]) => ({ userId, paid: fromCents(c) })).sort((x, y) => y.paid - x.paid),
    transfersLeft: settlements(applyPayments(computeBalances(a.expenses, a.memberIds), a.payments)).length,
  };
}

/** Petit texte à envoyer (messagerie, e-mail). */
export function balanceText(b: FinalBalance, o: { title: string; money: (n: number) => string; name: (userId: string) => string }): string {
  const lines = [`Bilan · ${o.title}`, `Total : ${o.money(b.total)}${b.budget ? ` (budget ${o.money(b.budget)}, ${b.delta >= 0 ? `${o.money(b.delta)} de moins` : `${o.money(-b.delta)} de plus`})` : ''}`,
    `Par jour : ${o.money(b.perDay)} · par personne : ${o.money(b.perPerson)}`];
  if (b.postes.length) lines.push('', ...b.postes.map((p) => `${POSTE_NAMES[p.poste]} : ${o.money(p.paid)}${p.envelope ? ` / ${o.money(p.envelope)} prévus` : ''}`));
  if (b.payers.length > 1) lines.push('', ...b.payers.map((p) => `${o.name(p.userId)} a payé ${o.money(p.paid)}`));
  lines.push('', b.transfersLeft ? `Encore ${b.transfersLeft} remboursement${b.transfersLeft > 1 ? 's' : ''} pour être quittes.` : 'Tout est réglé.', '— Waypoint');
  return lines.join('\n');
}

const cell = (v: string | number): string => {
  const s = String(v);
  return /[";\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s;
};

/** Tableau des dépenses (séparateur « ; » et virgule décimale : s'ouvre tel quel dans Excel en français). */
export function expensesCsv(expenses: ExpenseRow[], o: { currency: string; name: (userId: string | null) => string }): string {
  const rows = [...expenses].sort((x, y) => (x.spent_on ?? '').localeCompare(y.spent_on ?? ''))
    .map((e) => [e.spent_on ?? '', e.label ?? '', POSTE_NAMES[e.poste], (Number(e.amount) || 0).toFixed(2).replace('.', ','), o.currency, o.name(e.paid_by)].map(cell).join(';'));
  return ['Date;Dépense;Poste;Montant;Devise;Payé par', ...rows].join('\r\n');
}
