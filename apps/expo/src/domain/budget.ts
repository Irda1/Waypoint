// Budget, soldes entre amis et état de paiement — logique de la maquette (web/index.html :
// soldes(), virements(), bilanBudget(), etatPaiements()) portée en TypeScript.
// Les calculs se font en CENTIMES entiers : jamais d'erreur d'arrondi flottant,
// et la somme des parts est toujours égale au total.
import type { Expense, Place, Poste, TripItem } from './types.ts';
import { POSTES } from './types.ts';

export const toCents = (euros: number): number => Math.round(euros * 100);
export const fromCents = (cents: number): number => cents / 100;

export interface Balance {
  userId: string;
  paid: number;   // avancé par cette personne (euros)
  share: number;  // sa part des dépenses (euros)
  balance: number; // > 0 : on lui doit de l'argent ; < 0 : elle doit de l'argent
}

/**
 * Dépenses partagées à parts égales entre les membres. Le reste de la division
 * (quelques centimes) est réparti un centime à la fois, dans l'ordre des membres.
 * Une dépense avancée par quelqu'un qui n'est plus dans `memberIds` reste comptée
 * dans le total et lui est créditée : il apparaît alors avec un solde positif.
 */
export function computeBalances(expenses: Pick<Expense, 'amount' | 'paid_by'>[], memberIds: string[]): Balance[] {
  const ids = [...new Set([...memberIds, ...expenses.map((e) => e.paid_by).filter((x): x is string => !!x)])];
  const active = memberIds.length > 0 ? memberIds : ids;
  const total = expenses.reduce((s, e) => s + toCents(e.amount), 0);
  const base = Math.floor(total / active.length);
  let remainder = total - base * active.length;

  const shares = new Map<string, number>();
  for (const id of active) {
    shares.set(id, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder--;
  }
  const paidBy = new Map<string, number>();
  for (const e of expenses) {
    if (!e.paid_by) continue;
    paidBy.set(e.paid_by, (paidBy.get(e.paid_by) ?? 0) + toCents(e.amount));
  }
  return ids.map((userId) => {
    const paid = paidBy.get(userId) ?? 0;
    const share = shares.get(userId) ?? 0;
    return { userId, paid: fromCents(paid), share: fromCents(share), balance: fromCents(paid - share) };
  });
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export interface SettlementPayment { from_user: string; to_user: string; amount: number }

/** Tient compte des remboursements déjà reçus : celui qui a remboursé doit moins, celui qui a reçu doit moins qu'on ne lui doit. */
export function applyPayments(balances: Balance[], payments: SettlementPayment[]): Balance[] {
  return balances.map((b) => {
    let cents = toCents(b.balance);
    for (const p of payments) {
      if (p.from_user === b.userId) cents += toCents(p.amount);
      if (p.to_user === b.userId) cents -= toCents(p.amount);
    }
    return { ...b, balance: fromCents(cents) };
  });
}

/** Virements minimaux pour solder les comptes (méthode de la maquette : plus gros débiteur vers plus gros créancier). */
export function settlements(balances: Balance[]): Transfer[] {
  const creditors = balances.map((b) => ({ id: b.userId, cents: toCents(b.balance) })).filter((b) => b.cents > 0).sort((a, b) => b.cents - a.cents);
  const debtors = balances.map((b) => ({ id: b.userId, cents: -toCents(b.balance) })).filter((b) => b.cents > 0).sort((a, b) => b.cents - a.cents);
  const out: Transfer[] = [];
  for (const d of debtors) {
    for (const c of creditors) {
      if (d.cents === 0) break;
      const m = Math.min(d.cents, c.cents);
      if (m === 0) continue;
      out.push({ from: d.id, to: c.id, amount: fromCents(m) });
      d.cents -= m;
      c.cents -= m;
    }
  }
  return out;
}

export type PaymentState = 'paid' | 'partial' | 'unpaid' | null;

/**
 * Pastille de l'itinéraire : dollar plein vert = payé, contour vert = acompte,
 * gris = pas encore payé, `null` = gratuit ou prix inconnu (aucune pastille).
 * Le prix de l'étape est le prix par personne × le nombre de voyageurs.
 */
export function paymentState(item: Pick<TripItem, 'id' | 'place_id'>, place: Pick<Place, 'price_amount'> | undefined,
  expenses: Pick<Expense, 'amount' | 'item_id'>[], travelers: number): PaymentState {
  const unit = place?.price_amount ?? 0;
  const price = toCents(unit * Math.max(1, travelers));
  if (price <= 0) return null;
  const paid = expenses.filter((e) => e.item_id === item.id).reduce((s, e) => s + toCents(e.amount), 0);
  if (paid >= price) return 'paid';
  return paid > 0 ? 'partial' : 'unpaid';
}

/** Gastronomie et soirées comptent dans « Repas » ; le reste dans « Activités » (règle de la maquette). */
export const posteForCategory = (category: string | null | undefined): Poste =>
  category === 'gastronomie' || category === 'nocturne' || category === 'restaurant' || category === 'cafe'
  || category === 'street_food' || category === 'bar' || category === 'club' || category === 'marche'
    ? 'repas' : 'activites';

export interface PosteSummary {
  paid: number;      // dépenses saisies
  forecast: number;  // reste estimé des étapes prévues pas encore payées
  envelope: number;  // budget prévu pour ce poste
}

/**
 * Bilan par poste : payé (dépenses réelles) + prévisionnel (étapes du voyage dont le
 * prix n'est pas encore couvert) comparés à l'enveloppe. Le prévisionnel ne compte
 * jamais deux fois une étape déjà payée (les paiements sont reliés par item_id).
 */
export function budgetSummary(args: {
  expenses: Pick<Expense, 'amount' | 'poste' | 'item_id'>[];
  items: Pick<TripItem, 'id' | 'place_id' | 'category_code' | 'plan'>[];
  places: Map<number, Pick<Place, 'price_amount' | 'category_code'>>;
  envelopes: Partial<Record<Poste, number>>;
  travelers: number;
}): Record<Poste, PosteSummary> {
  const cents = Object.fromEntries(POSTES.map((p) => [p, { paid: 0, forecast: 0 }])) as Record<Poste, { paid: number; forecast: number }>;
  for (const e of args.expenses) cents[e.poste].paid += toCents(e.amount);

  for (const it of args.items) {
    if (it.plan !== 'A' || it.place_id == null) continue;   // seul le plan A est le programme réel
    const place = args.places.get(it.place_id);
    const price = toCents((place?.price_amount ?? 0) * Math.max(1, args.travelers));
    if (price <= 0) continue;
    const paid = args.expenses.filter((e) => e.item_id === it.id).reduce((s, e) => s + toCents(e.amount), 0);
    const remaining = Math.max(0, price - paid);
    if (remaining > 0) cents[posteForCategory(it.category_code ?? place?.category_code)].forecast += remaining;
  }
  return Object.fromEntries(POSTES.map((p) => [p, {
    paid: fromCents(cents[p].paid),
    forecast: fromCents(cents[p].forecast),
    envelope: args.envelopes[p] ?? 0,
  }])) as Record<Poste, PosteSummary>;
}

export interface SavingItem { itemId: string; name: string; cost: number }
export interface Saving {
  poste: Poste;
  /** Dépassement du budget prévu pour ce poste. */
  over: number;
  /** Étapes prévues à retirer pour revenir sous le budget (de la moins chère suffisante, sinon les plus chères d'abord). */
  remove: SavingItem[];
  /** Ce qu'il resterait sous le budget après ces retraits (≥ 0), ou ce qui dépasserait encore si les étapes ne suffisent pas (< 0). */
  margin: number;
}

/**
 * « Revenir sous le budget » : pour chaque poste qui dépasse, propose des étapes du programme (plan A)
 * pas encore payées dont le retrait ramène le poste sous son enveloppe.
 */
export function savingSuggestions(args: {
  expenses: Pick<Expense, 'amount' | 'poste' | 'item_id'>[];
  items: Pick<TripItem, 'id' | 'place_id' | 'category_code' | 'plan' | 'title'>[];
  places: Map<number, Pick<Place, 'price_amount' | 'category_code'> & { name?: string }>;
  envelopes: Partial<Record<Poste, number>>;
  travelers: number;
}): Saving[] {
  const summary = budgetSummary(args);
  const out: Saving[] = [];
  for (const p of POSTES) {
    const s = summary[p];
    const spent = toCents(s.paid + s.forecast);
    const envelope = toCents(s.envelope);
    if (!envelope || spent <= envelope) continue;
    const over = spent - envelope;
    const candidates: { itemId: string; name: string; cents: number }[] = [];
    for (const it of args.items) {
      if (it.plan !== 'A' || it.place_id == null) continue;
      const place = args.places.get(it.place_id);
      if (posteForCategory(it.category_code ?? place?.category_code) !== p) continue;
      const price = toCents((place?.price_amount ?? 0) * Math.max(1, args.travelers));
      const paid = args.expenses.filter((e) => e.item_id === it.id).reduce((sum, e) => sum + toCents(e.amount), 0);
      const remaining = Math.max(0, price - paid);
      if (remaining > 0) candidates.push({ itemId: it.id, name: place?.name ?? it.title ?? 'Étape', cents: remaining });
    }
    const single = candidates.filter((c) => c.cents >= over).sort((a, b) => a.cents - b.cents)[0];
    let picked: typeof candidates;
    if (single) picked = [single];
    else {
      picked = [];
      let left = over;
      for (const c of [...candidates].sort((a, b) => b.cents - a.cents)) {
        if (left <= 0) break;
        picked.push(c);
        left -= c.cents;
      }
    }
    const saved = picked.reduce((sum, c) => sum + c.cents, 0);
    out.push({ poste: p, over: fromCents(over), remove: picked.map((c) => ({ itemId: c.itemId, name: c.name, cost: fromCents(c.cents) })), margin: fromCents(saved - over) });
  }
  return out;
}

/** Coût prévu des étapes du plan A pour chaque jour (prix par personne × voyageurs), pour le graphique du budget. */
export function costByDay(days: { id: string }[], items: Pick<TripItem, 'day_id' | 'place_id' | 'plan'>[],
  places: Map<number, Pick<Place, 'price_amount'>>, travelers: number): number[] {
  return days.map((d) => fromCents(items
    .filter((it) => it.day_id === d.id && it.plan === 'A' && it.place_id != null)
    .reduce((sum, it) => sum + toCents((places.get(it.place_id!)?.price_amount ?? 0) * Math.max(1, travelers)), 0)));
}
