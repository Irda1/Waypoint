-- Waypoint · migration 1800 : élargir la zone de lieux d'une ville déjà prête
--
-- Une ville « prête » ne pouvait plus être rechargée depuis l'appli. Le bouton « Élargir la zone » de la carte
-- reprend la main sur une ville prête (comme begin_city_collection) pour lire un rayon plus grand ; l'écriture
-- passe ensuite par ingest_city_places (inchangée : ajoute ou met à jour, ne supprime rien, reste dans la zone
-- autorisée autour de la ville). Mêmes garde-fous : connexion requise, une seule personne à la fois,
-- 30 collectes par personne et par jour.
--
-- Retour : 'go' (à toi de collecter), 'busy' (quelqu'un d'autre ou la ville n'est pas prête : rien à élargir).
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1700.
-- Sans elle l'appli marche comme avant, sans le bouton « Élargir la zone ».

create or replace function public.extend_city_collection(p_city bigint)
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
  if v_status <> 'ready' or exists (
    select 1 from public.ingestion_queue where city_id = p_city and pass = 'places' and status in ('queued', 'running')
  ) then
    return 'busy';
  end if;

  if (select count(*) from public.ingestion_queue q
      where q.requested_by = v_uid and q.requested_at > now() - interval '1 day') >= 30 then
    raise exception 'trop de demandes de collecte aujourd''hui' using errcode = '54000';
  end if;

  insert into public.ingestion_queue (city_id, pass, status, requested_by, started_at, attempts)
  values (p_city, 'places', 'running', v_uid, now(), 1);
  update public.cities set collection_status = 'collecting' where id = p_city;
  return 'go';
end;
$$;

revoke all on function public.extend_city_collection(bigint) from public, anon, authenticated;
grant execute on function public.extend_city_collection(bigint) to authenticated, service_role;
