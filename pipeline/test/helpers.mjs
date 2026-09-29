// Faux serveur PostgREST en mémoire pour tester le pipeline sans réseau ni base.
import { createServer } from 'node:http';

export async function startFakeSupabase({ onRequest } = {}) {
  const calls = [];
  const state = { nextId: 100, failOnce: {} };
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      const url = new URL(req.url, 'http://x');
      const body = raw ? JSON.parse(raw) : null;
      const call = { method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body };
      calls.push(call);
      const key = `${req.method} ${url.pathname}`;
      if (state.failOnce[key]) {
        const status = state.failOnce[key];
        delete state.failOnce[key];
        res.writeHead(status, { 'content-type': 'application/json', 'retry-after': '0' });
        return res.end(JSON.stringify({ message: 'boom' }));
      }
      const custom = onRequest?.(call, state);
      if (custom) {
        res.writeHead(custom.status ?? 200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(custom.body ?? null));
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      const prefer = req.headers.prefer || '';
      if (req.method === 'POST' && prefer.includes('return=representation')) {
        const rows = (Array.isArray(body) ? body : [body]).map((r) => ({ id: state.nextId++, ...r }));
        return res.end(JSON.stringify(rows.map((r) => {
          const sel = url.searchParams.get('select');
          if (!sel || sel === '*') return r;
          const out = {};
          for (const k of sel.split(',')) out[k] = r[k];
          return out;
        })));
      }
      res.end(req.method === 'GET' ? '[]' : '');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, calls, state, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}

export const silent = () => {};
