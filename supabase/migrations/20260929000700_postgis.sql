-- Waypoint · migration 0700 : PostGIS (recherche « dans un rayon de X m »)
--
-- Séparée des autres car PostGIS est une extension : disponible sur Supabase
-- (activée ici), absente d'un PostgreSQL nu. Sans elle, les tables fonctionnent
-- quand même ; seule la recherche par rayon (places_nearby) en dépend.

create extension if not exists postgis with schema extensions;

-- Colonne géographique dérivée des colonnes lat / lng (jamais saisie à la main).
alter table public.places
  add column geog extensions.geography(Point, 4326)
  generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored;

create index places_geog_idx on public.places using gist (geog);

alter table public.cities
  add column geog extensions.geography(Point, 4326)
  generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored;

create index cities_geog_idx on public.cities using gist (geog);

-- Lieux autour d'un point (l'hôtel, la position de l'utilisateur), triés par distance.
-- SECURITY INVOKER : la RLS de `places` s'applique (lecture publique des lieux actifs).
create or replace function public.places_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 1000,
  p_kind text default null,
  p_categories text[] default null,
  p_limit integer default 50
)
returns table (
  id bigint, name text, kind text, category_code text,
  lat double precision, lng double precision, distance_m double precision
)
language sql
stable
set search_path = ''
as $$
  select p.id, p.name, p.kind, p.category_code, p.lat, p.lng,
         extensions.st_distance(p.geog, ref.g) as distance_m
  from public.places p,
       lateral (select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g) ref
  where p.status = 'active'
    and extensions.st_dwithin(p.geog, ref.g, least(greatest(p_radius_m, 1), 50000))
    and (p_kind is null or p.kind = p_kind)
    and (p_categories is null or p.category_code = any (p_categories))
  order by p.geog operator(extensions.<->) ref.g
  limit least(greatest(p_limit, 1), 200);
$$;

grant execute on function public.places_nearby(double precision, double precision, integer, text, text[], integer)
  to anon, authenticated, service_role;
