-- Waypoint · migration 1600 : collecte des lieux d'une ville depuis l'appli, en quelques secondes
--
-- Avant : une ville jamais collectée attendait le robot GitHub (jusqu'à 3 h, puis 2 à 6 min de collecte).
-- Maintenant : l'appli de la personne qui choisit la ville interroge OpenStreetMap (Overpass) elle-même,
-- trie les résultats avec les mêmes règles que le pipeline, puis les écrit par ces trois fonctions.
-- Si l'appli n'y arrive pas (réseau, serveur surchargé), elle rend la main à la file du robot (release).
--
-- Garde-fous : connexion requise, une seule personne collecte une ville à la fois (la tâche « running » de la file),
-- seule cette personne peut écrire, au plus 1 500 lieux, seulement autour de la ville, catégories connues,
-- 30 villes par personne et par jour. Rien d'autre que `places` et `place_sources` n'est modifiable.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1500.

-- 1. Prendre la main sur une ville : 'go' (à toi de collecter), 'ready' (déjà prête), 'busy' (quelqu'un d'autre s'en occupe).
create or replace function public.begin_city_collection(p_city bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_job public.ingestion_queue%rowtype;
begin
  if v_uid is null then
    raise exception 'connexion requise' using errcode = '28000';
  end if;

  select collection_status into v_status from public.cities where id = p_city for update;
  if not found then
    raise exception 'ville inconnue' using errcode = 'P0002';
  end if;
  if v_status = 'ready' then
    return 'ready';
  end if;

  select * into v_job from public.ingestion_queue
   where city_id = p_city and pass = 'places' and status in ('queued', 'running') for update;

  if found and v_job.status = 'running' and v_job.requested_by is distinct from v_uid
     and v_job.started_at > now() - interval '4 minutes' then
    return 'busy';
  end if;

  if found and v_job.requested_by is not distinct from v_uid and v_job.status = 'running' then
    update public.ingestion_queue set started_at = now() where id = v_job.id;
  else
    -- garde-fou anti-abus : 30 villes par personne et par jour
    if (select count(*) from public.ingestion_queue q
        where q.requested_by = v_uid and q.requested_at > now() - interval '1 day') >= 30 then
      raise exception 'trop de demandes de collecte aujourd''hui' using errcode = '54000';
    end if;
    if found then
      update public.ingestion_queue
         set status = 'running', started_at = now(), requested_by = v_uid, requested_at = now(), attempts = attempts + 1
       where id = v_job.id;
    else
      insert into public.ingestion_queue (city_id, pass, status, requested_by, started_at, attempts)
      values (p_city, 'places', 'running', v_uid, now(), 1);
    end if;
  end if;

  update public.cities set collection_status = 'collecting' where id = p_city;
  return 'go';
end;
$$;

-- 2. Écrire les lieux collectés. Retourne le nombre de lieux écrits.
create or replace function public.ingest_city_places(p_city bigint, p_places jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_city public.cities%rowtype;
  v_job_id bigint;
  v_written integer := 0;
begin
  if v_uid is null then
    raise exception 'connexion requise' using errcode = '28000';
  end if;
  if p_places is null or jsonb_typeof(p_places) <> 'array' then
    raise exception 'liste de lieux invalide' using errcode = '22023';
  end if;
  if jsonb_array_length(p_places) > 1500 then
    raise exception 'trop de lieux à la fois' using errcode = '54000';
  end if;

  select * into v_city from public.cities where id = p_city for update;
  if not found then
    raise exception 'ville inconnue' using errcode = 'P0002';
  end if;

  -- Seule la personne qui a pris la main (begin_city_collection) peut écrire.
  select id into v_job_id from public.ingestion_queue
   where city_id = p_city and pass = 'places' and status = 'running' and requested_by = v_uid;
  if v_job_id is null then
    raise exception 'collecte non démarrée pour cette ville' using errcode = '42501';
  end if;

  with incoming as (
    select * from jsonb_to_recordset(p_places) as x(
      kind text, category_code text, name text, name_local text, address text,
      lat double precision, lng double precision, opening_hours text, closed_days smallint[],
      visit_duration_min integer, website text, phone text, popularity real,
      osm_type text, osm_id bigint, wikidata_id text, tags jsonb, source_url text
    )
  ), valid as (
    select distinct on (i.osm_type, i.osm_id) i.* from incoming i
    join public.place_categories c on c.code = i.category_code and c.kind = i.kind
    where i.osm_type in ('node', 'way', 'relation') and i.osm_id is not null
      and i.name is not null and length(btrim(i.name)) between 1 and 200
      and i.lat between v_city.lat - 1.0 and v_city.lat + 1.0
      and i.lng between v_city.lng - 1.5 and v_city.lng + 1.5
      and coalesce(i.popularity, 0) >= 0
  ), written as (
    insert into public.places (
      city_id, kind, category_code, name, name_local, address, lat, lng, opening_hours, closed_days,
      visit_duration_min, duration_is_estimate, website, phone, popularity, osm_type, osm_id, wikidata_id,
      tags, status, source, license, source_url, retrieved_at
    )
    select p_city, v.kind, v.category_code, left(btrim(v.name), 200), left(v.name_local, 200), left(v.address, 300),
           v.lat, v.lng, left(v.opening_hours, 500), coalesce(v.closed_days, '{}'),
           case when v.kind = 'activity' then v.visit_duration_min end, true,
           left(v.website, 500), left(v.phone, 60), coalesce(v.popularity, 0), v.osm_type, v.osm_id, left(v.wikidata_id, 30),
           coalesce(v.tags, '{}'::jsonb), 'active', 'openstreetmap', 'ODbL 1.0',
           'https://www.openstreetmap.org/' || v.osm_type || '/' || v.osm_id, now()
    from valid v
    on conflict (osm_type, osm_id) do update set
      name = excluded.name, name_local = excluded.name_local, address = excluded.address,
      lat = excluded.lat, lng = excluded.lng, opening_hours = excluded.opening_hours,
      closed_days = excluded.closed_days, website = excluded.website, phone = excluded.phone,
      popularity = excluded.popularity, tags = excluded.tags, retrieved_at = excluded.retrieved_at
    returning id, osm_type, osm_id
  ), sources as (
    insert into public.place_sources (place_id, source, external_id, license, license_risk, retrieved_at)
    select w.id, 'openstreetmap', w.osm_type || '/' || w.osm_id, 'ODbL 1.0', 'ok', now()
    from written w
    on conflict (place_id, source) do update set retrieved_at = excluded.retrieved_at
    returning 1
  )
  select count(*) into v_written from written;

  update public.cities set collection_status = 'ready', places_collected_at = now() where id = p_city;
  update public.ingestion_queue set status = 'done', finished_at = now(), error = null where id = v_job_id;
  return v_written;
end;
$$;

-- 3. Rendre la main au robot (l'appli n'a pas pu collecter) : la ville repasse « en file ».
create or replace function public.release_city_collection(p_city bigint, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'connexion requise' using errcode = '28000';
  end if;
  update public.ingestion_queue
     set status = 'queued', started_at = null, error = left(p_error, 500)
   where city_id = p_city and pass = 'places' and status = 'running' and requested_by = v_uid;
  if found then
    update public.cities set collection_status = 'queued' where id = p_city and collection_status = 'collecting';
  end if;
end;
$$;

revoke all on function public.begin_city_collection(bigint), public.ingest_city_places(bigint, jsonb),
  public.release_city_collection(bigint, text) from public, anon, authenticated;
grant execute on function public.begin_city_collection(bigint), public.ingest_city_places(bigint, jsonb),
  public.release_city_collection(bigint, text) to authenticated, service_role;
