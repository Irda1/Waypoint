// Taux de change (table exchange_rates, lecture publique) : chargés une fois par session.
import { useEffect, useState } from 'react';
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

/** Devise principale d'un pays (table countries) ; null si inconnue. */
export async function loadCountryCurrency(countryCode: string): Promise<string | null> {
  const { data, error } = await supabase.from('countries').select('currency_codes').eq('code', countryCode).maybeSingle();
  const codes = (data as { currency_codes: string[] | null } | null)?.currency_codes;
  return error || !codes?.length ? null : codes[0];
}

/** Taux du jour et monnaie locale du premier pays du voyage (rien tant que ce n'est pas chargé). */
export function useLocalMoney(countryCode: string | null): { rates: RateTable; local: string | null } {
  const [state, setState] = useState<{ rates: RateTable; local: string | null }>({ rates: EMPTY_RATES, local: null });
  useEffect(() => {
    let alive = true;
    void Promise.all([loadRates(), countryCode ? loadCountryCurrency(countryCode) : Promise.resolve(null)])
      .then(([rates, local]) => { if (alive) setState({ rates, local }); });
    return () => { alive = false; };
  }, [countryCode]);
  return state;
}
