// Taux de change (table exchange_rates, lecture publique) : chargés une fois par session.
import { supabase } from '../lib/supabase';
import { buildRateTable, EMPTY_RATES } from '../domain/currency.ts';
import type { RateTable } from '../domain/currency.ts';

let cache: Promise<RateTable> | null = null;

/** Sans taux en base (passe « rates » jamais lancée), on renvoie une table vide : aucune conversion affichée. */
export function loadRates(): Promise<RateTable> {
  if (!cache) {
    cache = (async () => {
      const { data, error } = await supabase.from('exchange_rates').select('quote,rate,rate_date');
      return error || !data ? EMPTY_RATES : buildRateTable(data as { quote: string; rate: number; rate_date: string }[]);
    })();
    void cache.then((t) => { if (t === EMPTY_RATES) cache = null; });
  }
  return cache;
}
