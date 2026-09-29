-- Waypoint · migration 0600 : temps réel et fonctions appelables par l'app (RPC)

-- ---------------------------------------------------------------------------
-- Temps réel (Supabase Realtime, « Postgres Changes »)
-- Chaque membre écoute les tables de son voyage avec un filtre trip_id=eq.<id> ;
-- la RLS est appliquée à chaque abonné pour les ajouts et modifications.
-- Les suppressions (DELETE) ne sont PAS contrôlées par la RLS (documentation
-- Supabase, « Postgres Changes ») : on garde l'identité de réplique par défaut
-- (clé primaire seule, un uuid sans contenu) et le client retire la ligne par
-- son id. Ne pas passer ces tables en `replica identity full` : l'ancienne ligne
-- complète serait alors diffusée aux abonnés de la table.
-- La publication n'existe que sur Supabase ; en local pur PostgreSQL on l'ignore.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'trips', 'trip_members', 'trip_days', 'trip_items', 'trip_stays',
      'expenses', 'trip_budget_lines', 'saved_places', 'trip_activity_log'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Inviter / rejoindre un voyage
-- ---------------------------------------------------------------------------

-- Aperçu d'une invitation pour l'écran « Rejoindre » (titre, dates, nombre de membres).
-- Ne renvoie rien si le code est inconnu, expiré, révoqué ou épuisé.
create or replace function public.preview_invite(p_code text)
returns table (trip_id uuid, title text, starts_on date, ends_on date, member_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, t.starts_on, t.ends_on,
         (select count(*)::integer from public.trip_members m where m.trip_id = t.id and m.left_at is null)
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where i.code = upper(btrim(p_code))
    and (select auth.uid()) is not null
    and t.deleted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and (i.max_uses is null or i.uses < i.max_uses);
$$;

-- Rejoindre un voyage avec un code : l'utilisateur devient membre à part entière.
create or replace function public.join_trip(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.trip_invites;
  v_was_member boolean;
begin
  if v_uid is null then
    raise exception 'connexion requise' using errcode = '28000';
  end if;

  select i.* into v_inv
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  where i.code = upper(btrim(p_code))
    and t.deleted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and (i.max_uses is null or i.uses < i.max_uses)
  for update of i;

  if not found then
    raise exception 'invitation invalide ou expirée' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.trip_members m
    where m.trip_id = v_inv.trip_id and m.user_id = v_uid and m.left_at is null
  ) into v_was_member;

  if not v_was_member then
    insert into public.trip_members (trip_id, user_id)
    values (v_inv.trip_id, v_uid)
    on conflict (trip_id, user_id) do update set left_at = null, joined_at = now();
    update public.trip_invites set uses = uses + 1 where code = v_inv.code;
  end if;

  return v_inv.trip_id;
end;
$$;

-- Quitter un voyage (les dépenses avancées restent à son nom).
create or replace function public.leave_trip(p_trip uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.trip_members
  set left_at = now()
  where trip_id = p_trip and user_id = (select auth.uid()) and left_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Collecte à la demande : l'app demande qu'une ville soit remplie ; le pipeline
-- (clé de service) prend les tâches une par une dans la file.
-- ---------------------------------------------------------------------------
create or replace function public.request_city_collection(p_city bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'connexion requise' using errcode = '28000';
  end if;

  select collection_status into v_status from public.cities where id = p_city for update;
  if not found then
    raise exception 'ville inconnue' using errcode = 'P0002';
  end if;

  if v_status in ('ready', 'queued', 'collecting') then
    return v_status;
  end if;

  -- garde-fou anti-abus : 20 demandes par utilisateur et par jour
  if (select count(*) from public.ingestion_queue q
      where q.requested_by = v_uid and q.requested_at > now() - interval '1 day') >= 20 then
    raise exception 'trop de demandes de collecte aujourd''hui' using errcode = '54000';
  end if;

  insert into public.ingestion_queue (city_id, pass, requested_by)
  values (p_city, 'places', v_uid)
  on conflict do nothing;

  update public.cities set collection_status = 'queued' where id = p_city;
  return 'queued';
end;
$$;

-- Réservé au pipeline : prend la prochaine tâche sans jamais la donner à deux
-- exécutions en parallèle (FOR UPDATE SKIP LOCKED). C'est le « flux unique » du
-- départ ; on pourra lancer plusieurs consommateurs sans changer le schéma.
create or replace function public.claim_collection_job(p_pass text default 'places')
returns setof public.ingestion_queue
language sql
security definer
set search_path = ''
as $$
  update public.ingestion_queue q
  set status = 'running', started_at = now(), attempts = q.attempts + 1
  where q.id = (
    select id from public.ingestion_queue
    where status = 'queued' and pass = p_pass
    order by priority desc, requested_at
    for update skip locked
    limit 1
  )
  returning q.*;
$$;

-- Supabase accorde par défaut EXECUTE à anon et authenticated sur toute nouvelle
-- fonction : on retire tout explicitement, puis on accorde au cas par cas.
revoke all on function public.preview_invite(text), public.join_trip(text), public.leave_trip(uuid),
  public.request_city_collection(bigint), public.claim_collection_job(text) from public, anon, authenticated;

grant execute on function public.preview_invite(text), public.join_trip(text), public.leave_trip(uuid),
  public.request_city_collection(bigint) to authenticated, service_role;
grant execute on function public.claim_collection_job(text) to service_role;
