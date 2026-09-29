// Client minimal de l'API REST de Supabase (PostgREST), sans dépendance.
// Utilisé avec la clé de service : il contourne la sécurité par ligne et ne doit
// donc tourner que dans le pipeline (jamais dans l'app).

import { fetchRetry, HttpError } from './http.mjs';

export function createSupabase({ url, serviceKey, fetchImpl = fetch, dryRun = false, log = () => {} }) {
  const base = `${url}/rest/v1`;
  const headers = (extra = {}) => ({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  });
  const call = (path, init) => fetchRetry(`${base}${path}`, init, { fetchImpl, retries: 3 });

  return {
    dryRun,

    /** Lecture : `query` est la chaîne PostgREST (ex. "select=id,name&limit=10"). */
    async select(table, query = '') {
      const res = await call(`/${table}${query ? `?${query}` : ''}`, { headers: headers() });
      return res.json();
    },

    /**
     * Insertion ou mise à jour en lot. Toutes les lignes d'un lot doivent avoir les
     * mêmes clés ; seules les colonnes présentes sont mises à jour.
     * @returns {Promise<object[]>} lignes écrites si `returning` est fourni
     */
    async upsert(table, rows, { onConflict, returning = null, chunkSize = 500 } = {}) {
      if (!rows.length) return [];
      if (dryRun) {
        log(`[simulation] ${table} : ${rows.length} ligne(s) non écrites`);
        return [];
      }
      const out = [];
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const params = new URLSearchParams();
        if (onConflict) params.set('on_conflict', onConflict);
        if (returning) params.set('select', returning);
        const res = await call(`/${table}?${params}`, {
          method: 'POST',
          headers: headers({
            Prefer: `resolution=merge-duplicates,return=${returning ? 'representation' : 'minimal'}`,
          }),
          body: JSON.stringify(chunk),
        });
        if (returning) out.push(...(await res.json()));
      }
      return out;
    },

    /** Insertion simple d'une ligne, renvoie la ligne créée. */
    async insert(table, row, returning = '*') {
      if (dryRun) return { id: null, ...row };
      const res = await call(`/${table}?select=${encodeURIComponent(returning)}`, {
        method: 'POST',
        headers: headers({ Prefer: 'return=representation' }),
        body: JSON.stringify(row),
      });
      return (await res.json())[0];
    },

    /** Mise à jour filtrée : `filter` = "id=eq.12". */
    async patch(table, filter, values) {
      if (dryRun) return;
      await call(`/${table}?${filter}`, {
        method: 'PATCH',
        headers: headers({ Prefer: 'return=minimal' }),
        body: JSON.stringify(values),
      });
    },

    /** Appel d'une fonction SQL (RPC). */
    async rpc(fn, args = {}) {
      const res = await call(`/rpc/${fn}`, { method: 'POST', headers: headers(), body: JSON.stringify(args) });
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    },
  };
}

export { HttpError };
