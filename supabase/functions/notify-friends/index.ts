// Waypoint · fonction Edge « notify-friends » : envoie les notifications entre amis (migration 2900).
//
// Lancée chaque minute par une tâche planifiée (Supabase > Integrations > Cron). Elle lit la file `notif_queue`, regroupe
// les changements par ami, voyage et type (un ami qui remplit tout le programme = une seule notification), attend qu'il
// ait fini (2 minutes sans nouveau changement), puis envoie à chaque autre membre du voyage qui a gardé ce type de
// notification, sur ses téléphones Android, par Firebase Cloud Messaging.
// Secrets : FIREBASE_SERVICE_ACCOUNT (clé du compte de service Firebase) ; SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
// sont fournis par Supabase. Aucune dépendance : le fichier se colle tel quel dans l'éditeur de fonctions de Supabase.

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };

export type Kind = 'programme' | 'depenses' | 'reservations' | 'carnet' | 'voyageurs';
export interface QueueRow { id: number; trip_id: string; actor: string; kind: Kind; action: string; label: string; amount: number | string | null; currency: string | null; created_at: string }
export interface Group { tripId: string; actor: string; kind: Kind; rows: QueueRow[] }

/** Un ami a « fini » quand il n'a rien changé depuis 2 minutes ; au-delà de 15 minutes on envoie quand même. */
export const QUIET_MS = 2 * 60_000;
export const MAX_WAIT_MS = 15 * 60_000;

/** Groupes prêts à partir (ami, voyage, type), dans l'ordre d'arrivée. */
export function readyGroups(rows: QueueRow[], now: number): Group[] {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = `${r.trip_id}|${r.actor}|${r.kind}`;
    if (!groups.has(key)) groups.set(key, { tripId: r.trip_id, actor: r.actor, kind: r.kind, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  return [...groups.values()].filter((g) => {
    const times = g.rows.map((r) => Date.parse(r.created_at));
    return now - Math.max(...times) >= QUIET_MS || now - Math.min(...times) >= MAX_WAIT_MS;
  });
}

const money = (amount: number | string | null, currency: string | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: Number(amount) % 1 ? 2 : 0 }).format(Number(amount ?? 0));
const list = (labels: string[]) => {
  const unique = [...new Set(labels.filter(Boolean))];
  return unique.slice(0, 3).join(', ') + (unique.length > 3 ? '…' : '');
};
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Texte de la notification : `title` dit ce que l'ami a fait, `body` précise, avec le nom du voyage. */
export function messageFor(g: Group, actorName: string, tripTitle: string): { title: string; body: string } {
  const rows = g.rows;
  const one = rows.length === 1 ? rows[0] : null;
  const end = (detail: string) => (detail ? `${detail} · ${tripTitle}` : tripTitle);
  switch (g.kind) {
    case 'programme': {
      if (one && one.label) {
        const verb = one.action === 'ajout' ? 'a ajouté' : one.action === 'retrait' ? 'a retiré' : 'a déplacé';
        return { title: `${actorName} ${verb} ${one.label}`, body: end('Programme') };
      }
      const labels = list(rows.map((r) => r.label));
      return { title: `${actorName} a changé le programme`, body: end(`${plural(rows.length, 'étape')}${labels ? ` : ${labels}` : ''}`) };
    }
    case 'depenses': {
      const refunds = rows.filter((r) => r.action === 'remboursement');
      if (one && one.action === 'remboursement') return { title: `${actorName} a enregistré un remboursement de ${money(one.amount, one.currency)}`, body: end('') };
      if (one) return { title: `${actorName} a payé ${money(one.amount, one.currency)}`, body: end(one.label) };
      const paid = rows.length - refunds.length;
      return { title: `${actorName} a ajouté ${plural(paid || rows.length, paid ? 'dépense' : 'remboursement')}`, body: end(list(rows.map((r) => r.label))) };
    }
    case 'reservations': {
      if (one) return { title: one.action === 'billet' ? `${actorName} a joint un billet` : `${actorName} a ajouté une réservation`, body: end(one.label) };
      return { title: `${actorName} a ajouté ${rows.length} réservations ou billets`, body: end(list(rows.map((r) => r.label))) };
    }
    case 'carnet': {
      const photos = rows.filter((r) => r.action === 'photo').length;
      return { title: photos ? `${actorName} a ajouté ${plural(photos, 'photo')}` : `${actorName} a écrit dans le carnet`, body: end('Carnet') };
    }
    case 'voyageurs': {
      const last = rows[rows.length - 1];
      return { title: last.action === 'quitte' ? `${actorName} a quitté le voyage` : `${actorName} a rejoint le voyage`, body: end('') };
    }
  }
}

// ---------------------------------------------------------------- Envoi (Supabase + Firebase)

type Json = Record<string, unknown>;

async function rest(path: string, init: RequestInit = {}): Promise<Json[]> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path} : ${res.status} ${await res.text()}`);
  return init.method && init.method !== 'GET' ? [] : await res.json();
}
const inList = (ids: string[]) => `in.(${[...new Set(ids)].join(',')})`;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const text64 = (s: string) => b64url(new TextEncoder().encode(s));

/** Jeton d'accès Google (1 h) signé avec la clé du compte de service. */
async function googleToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${text64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${text64(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`;
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Firebase : ${JSON.stringify(data)}`);
  return data.access_token;
}

async function run(): Promise<{ sent: number; groups: number }> {
  const queue = (await rest('notif_queue?select=*&order=id.asc&limit=2000')) as unknown as QueueRow[];
  const now = Date.now();
  const groups = readyGroups(queue, now);
  // Lignes de plus d'un jour : on les oublie (voyage supprimé, envoi impossible).
  const stale = queue.filter((r) => now - Date.parse(r.created_at) > 86_400_000).map((r) => r.id);
  if (!groups.length) {
    if (stale.length) await rest(`notif_queue?id=in.(${stale.join(',')})`, { method: 'DELETE' });
    return { sent: 0, groups: 0 };
  }
  const tripIds = groups.map((g) => g.tripId);
  const [trips, members, actors] = await Promise.all([
    rest(`trips?select=id,title&deleted_at=is.null&id=${inList(tripIds)}`),
    rest(`trip_members?select=trip_id,user_id&left_at=is.null&trip_id=${inList(tripIds)}`),
    rest(`profiles?select=id,display_name&id=${inList(groups.map((g) => g.actor))}`),
  ]);
  const userIds = members.map((m) => m.user_id as string);
  const [prefs, devices] = userIds.length
    ? await Promise.all([rest(`notification_prefs?select=*&user_id=${inList(userIds)}`), rest(`push_devices?select=token,user_id&user_id=${inList(userIds)}`)])
    : [[], []];
  const title = new Map(trips.map((t) => [t.id as string, t.title as string]));
  const name = new Map(actors.map((a) => [a.id as string, a.display_name as string]));
  const pref = new Map(prefs.map((p) => [p.user_id as string, p]));
  const sa = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '{}');
  const token = devices.length ? await googleToken(sa) : '';
  let sent = 0;
  for (const g of groups) {
    const tripTitle = title.get(g.tripId);
    if (!tripTitle) continue;   // voyage supprimé
    const msg = messageFor(g, name.get(g.actor) ?? 'Un ami', tripTitle);
    const to = members.filter((m) => m.trip_id === g.tripId && m.user_id !== g.actor).map((m) => m.user_id as string)
      .filter((u) => { const p = pref.get(u); return !p || (p.enabled && p[g.kind]); });
    for (const d of devices.filter((x) => to.includes(x.user_id as string))) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: {
          token: d.token, notification: msg, data: { tripId: g.tripId, kind: g.kind },
          android: { notification: { channel_id: 'amis', tag: `${g.tripId}-${g.kind}` } },
        } }),
      });
      if (res.ok) sent++;
      else if (res.status === 404) await rest(`push_devices?token=eq.${encodeURIComponent(d.token as string)}`, { method: 'DELETE' });   // appli désinstallée : téléphone oublié
    }
  }
  const done = [...groups.flatMap((g) => g.rows.map((r) => r.id)), ...stale];
  await rest(`notif_queue?id=in.(${[...new Set(done)].join(',')})`, { method: 'DELETE' });
  return { sent, groups: groups.length };
}

if (typeof Deno !== 'undefined') {
  Deno.serve(async () => {
    try {
      return Response.json(await run());
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  });
}
