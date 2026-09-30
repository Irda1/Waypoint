// Passe · taux de change — Frankfurter (données de la BCE, sans clé). Tous les taux sont pour 1 EUR.
import { fetchRetry } from '../lib/http.mjs';
import { startRun, finishRun } from '../lib/run.mjs';

/** Transforme la réponse de l'API en lignes de la table exchange_rates (EUR -> chaque devise). */
export function parseRates(json) {
  const rates = json && typeof json === 'object' ? json.rates : null;
  if (!rates || typeof rates !== 'object' || json.base !== 'EUR' || !/^\d{4}-\d{2}-\d{2}$/.test(json.date ?? '')) {
    throw new Error('Taux de change : réponse inattendue (base EUR, date et taux attendus).');
  }
  const rows = [];
  for (const [quote, rate] of Object.entries(rates)) {
    if (/^[A-Z]{3}$/.test(quote) && typeof rate === 'number' && rate > 0) rows.push({ base: 'EUR', quote, rate, rate_date: json.date });
  }
  if (rows.length < 10) throw new Error(`Taux de change : seulement ${rows.length} devises reçues, écriture annulée.`);
  return rows;
}

export async function ratesPass({ sb, cfg, fetchImpl = fetch, log = console.log }) {
  const runId = await startRun(sb, { pass: 'rates', source: 'frankfurter.dev (BCE)', license: 'Données BCE, usage libre avec mention de la source' });
  try {
    const res = await fetchRetry(`${cfg.ratesBase}/latest?base=EUR`, {}, { fetchImpl });
    const rows = parseRates(await res.json());
    const stats = { read: rows.length, kept: rows.length, written: sb.dryRun ? 0 : rows.length };
    await sb.upsert('exchange_rates', rows.map((r) => ({ ...r, fetched_at: new Date().toISOString() })), { onConflict: 'base,quote' });
    log(`Taux : ${rows.length} devises pour 1 EUR (${rows[0].rate_date})${sb.dryRun ? ' (simulation)' : ', écrits'}.`);
    await finishRun(sb, runId, stats);
    return stats;
  } catch (err) {
    await finishRun(sb, runId, {}, err);
    throw err;
  }
}
