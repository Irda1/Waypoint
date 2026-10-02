-- Waypoint · migration 1700 : reprise des collectes abandonnées
--
-- Quand quelqu'un ferme l'appli pendant le chargement des lieux d'une ville (migration 1600), la tâche restait
-- « running » et la ville « collecting » pour toujours : le robot ne reprend que les tâches « en file ».
-- Désormais le robot remet d'abord « en file » toute tâche « running » commencée il y a plus de 10 minutes
-- (le robot ne prend une tâche qu'une fois la précédente terminée, donc une tâche plus ancienne est forcément abandonnée).
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1600.

create or replace function public.claim_collection_job(p_pass text default 'places')
returns setof public.ingestion_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  with stale as (
    update public.ingestion_queue
       set status = 'queued', started_at = null, error = 'reprise : collecte abandonnée'
     where status = 'running' and pass = p_pass and started_at < now() - interval '10 minutes'
    returning city_id
  )
  update public.cities set collection_status = 'queued'
   where id in (select city_id from stale) and collection_status = 'collecting';

  return query
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
end;
$$;

revoke all on function public.claim_collection_job(text) from public, anon, authenticated;
grant execute on function public.claim_collection_job(text) to service_role;
