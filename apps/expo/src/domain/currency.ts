// Conversion de devises : logique pure (testable avec Node). Les taux sont tous exprimés pour 1 EUR
// (table exchange_rates, alimentée par la passe « rates » du pipeline).

export interface RateTable { rates: Record<string, number>; date: string | null }

export const EMPTY_RATES: RateTable = { rates: { EUR: 1 }, date: null };

export function buildRateTable(rows: { quote: string; rate: number | string; rate_date: string }[]): RateTable {
  const rates: Record<string, number> = { EUR: 1 };
  let date: string | null = null;
  for (const r of rows) {
    const rate = Number(r.rate);
    if (rate > 0) rates[r.quote] = rate;
    if (!date || r.rate_date > date) date = r.rate_date;
  }
  return { rates, date };
}

/** Convertit un montant ; null si une des deux devises est inconnue (on n'invente jamais un taux). */
export function convert(amount: number, from: string, to: string, table: RateTable): number | null {
  if (from === to) return amount;
  const a = table.rates[from];
  const b = table.rates[to];
  if (!a || !b) return null;
  return (amount / a) * b;
}

/** Montant estimé, toujours précédé de « ≈ » (taux du jour, pas un taux bancaire). */
export function formatApprox(amount: number, currency: string, locale = 'fr-FR'): string {
  return `≈ ${new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: amount < 100 ? 2 : 0 }).format(amount)}`;
}
