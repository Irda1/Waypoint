// Requêtes HTTP robustes : identification, délai maximal, nouvelles tentatives
// avec attente croissante (429 / 5xx), respect de Retry-After, cadence limitée.

export const USER_AGENT = process.env.WAYPOINT_USER_AGENT
  || 'WaypointPipeline/1.0 (+https://github.com/Irda1/Waypoint)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  constructor(status, url, body) {
    super(`HTTP ${status} sur ${url}${body ? ` : ${String(body).slice(0, 300)}` : ''}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

/**
 * fetch avec nouvelles tentatives. Retente sur 429, 502, 503, 504 et erreurs réseau.
 * @param {string} url
 * @param {RequestInit} [init]
 * @param {{retries?: number, baseDelayMs?: number, timeoutMs?: number, fetchImpl?: typeof fetch}} [opts]
 */
export async function fetchRetry(url, init = {}, opts = {}) {
  const { retries = 4, baseDelayMs = 1000, timeoutMs = 120_000, fetchImpl = fetch } = opts;
  const headers = { 'User-Agent': USER_AGENT, ...(init.headers || {}) };
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      const retryable = [429, 502, 503, 504].includes(res.status);
      if (!retryable || attempt === retries) {
        throw new HttpError(res.status, url, await res.text().catch(() => ''));
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && res.headers.has('retry-after')
        ? retryAfter * 1000
        : baseDelayMs * 2 ** attempt;
      await res.body?.cancel?.();
      await sleep(wait);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      lastError = err;
      if (attempt === retries) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError ?? new Error(`Échec de la requête ${url}`);
}

/** Espace les appels d'au moins `minIntervalMs` (une seule file : « flux unique »). */
export class Throttle {
  constructor(minIntervalMs) {
    this.minIntervalMs = minIntervalMs;
    this.next = 0;
  }
  async wait() {
    const now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + this.minIntervalMs;
    if (at > now) await sleep(at - now);
  }
}
