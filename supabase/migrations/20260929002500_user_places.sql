-- Waypoint · migration 2500 : ajouter un lieu qui manque (suggestions OpenStreetMap, lien Google Maps)
--
-- L'écran « Ajouter un lieu » trouve aussi les lieux absents de la base : suggestions OpenStreetMap (service Photon)
-- et lien Google Maps collé dans la recherche. Le lieu choisi est enregistré par `add_user_place`, seule porte
-- d'entrée depuis l'appli (les voyageurs n'écrivent jamais directement dans `places`). Elle vérifie le nom, que le
-- point est à moins de 60 km de la ville, et le type de lieu ; elle réutilise un lieu déjà connu (même référence
-- OpenStreetMap, ou même nom au même endroit) ; au plus 40 lieux ajoutés par personne et par jour.
-- Depuis Google Maps on ne garde que le nom et la position, saisis par le voyageur.
-- Nouvelle colonne `places.added_by` : qui a ajouté le lieu (vidée si le compte est supprimé).
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 2400.
-- Sans elle l'appli marche comme avant : la recherche ne montre que les lieux de Waypoint.

alter table public.places add column if not exists added_by uuid references auth.users (id) on delete set null;
create index if not exists places_added_by_idx on public.places (added_by, retrieved_at) where added_by is not null;

create or replace function public.add_user_place(
  p_city     bigint,
  p_name     text,
  p_lat      double precision,
  p_lng      double precision,
  p_category text,
  p_source   text,                  -- 'osm' (suggestion Photon) ou 'google_maps' (lien collé)
  p_osm_type text default null,     -- 'node' | 'way' | 'relation', avec p_osm_id (suggestions OpenStreetMap)
  p_osm_id   bigint default null,
  p_address  text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_lat  double precision;
  v_lng  double precision;
  v_kind text;
  v_id   bigint;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Connexion requise pour ajouter un lieu.' using errcode = '42501';
  end if;
  if p_source is null or p_source not in ('osm', 'google_maps') then
    raise exception 'Origine du lieu inconnue.' using errcode = '22023';
  end if;
  if length(v_name) = 0 or length(v_name) > 120 then
    raise exception 'Nom du lieu vide ou trop long.' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Position du lieu invalide.' using errcode = '22023';
  end if;
  if (p_osm_type is null) <> (p_osm_id is null)
     or (p_osm_type is not null and (p_source <> 'osm' or p_osm_type not in ('node', 'way', 'relation'))) then
    raise exception 'Référence OpenStreetMap invalide.' using errcode = '22023';
  end if;

  select c.lat, c.lng into v_lat, v_lng from public.cities c where c.id = p_city;
  if not found then
    raise exception 'Ville inconnue.' using errcode = '22023';
  end if;
  -- Distance à vol d'oiseau (formule de haversine, en km) : sans PostGIS, pour rester testable partout.
  if 2 * 6371 * asin(sqrt(power(sin(radians(p_lat - v_lat) / 2), 2)
       + cos(radians(v_lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - v_lng) / 2), 2))) > 60 then
    raise exception 'Ce lieu est à plus de 60 km de la ville.' using errcode = '22023';
  end if;

  select pc.kind into v_kind from public.place_categories pc where pc.code = p_category and pc.kind in ('activity', 'service');
  if not found then
    raise exception 'Type de lieu inconnu.' using errcode = '22023';
  end if;

  -- Lieu déjà connu : même référence OpenStreetMap, sinon même nom à moins d'une centaine de mètres dans la ville.
  if p_osm_type is not null then
    select p.id, p.status into v_id, v_status from public.places p where p.osm_type = p_osm_type and p.osm_id = p_osm_id;
  end if;
  if v_id is null then
    select p.id, p.status into v_id, v_status from public.places p
    where p.city_id = p_city and lower(p.name) = lower(v_name)
      and abs(p.lat - p_lat) < 0.001 and abs(p.lng - p_lng) < 0.001
    order by (p.status = 'active') desc, p.id
    limit 1;
  end if;
  if v_id is not null then
    if v_status <> 'active' then
      raise exception 'Ce lieu a été masqué.' using errcode = '22023';
    end if;
    return v_id;
  end if;

  if (select count(*) from public.places p where p.added_by = v_uid and p.retrieved_at > now() - interval '1 day') >= 40 then
    raise exception 'Limite atteinte : 40 lieux ajoutés aujourd''hui. Réessaie demain.' using errcode = '53400';
  end if;

  insert into public.places (city_id, kind, category_code, name, address, lat, lng, osm_type, osm_id,
                             popularity, source, license, added_by)
  values (p_city, v_kind, p_category, v_name, left(nullif(btrim(p_address), ''), 200), p_lat, p_lng, p_osm_type, p_osm_id,
          0,
          case p_source when 'osm' then 'photon' else 'google_maps_link' end,
          case p_source when 'osm' then 'ODbL 1.0' else 'saisie voyageur' end,
          v_uid)
  on conflict (osm_type, osm_id) do nothing
  returning id into v_id;
  -- Deux voyageurs ajoutent le même lieu OpenStreetMap au même instant : on reprend celui qui vient d'être créé.
  if v_id is null then
    select p.id into v_id from public.places p where p.osm_type = p_osm_type and p.osm_id = p_osm_id;
  end if;
  return v_id;
end $$;

revoke all on function public.add_user_place(bigint, text, double precision, double precision, text, text, text, bigint, text) from public, anon;
grant execute on function public.add_user_place(bigint, text, double precision, double precision, text, text, text, bigint, text) to authenticated;
