-- Waypoint · migration 2400 : positions des villes dans la page de partage
--
-- La page publique d'un voyage partagé par lien montre maintenant la planète qui refait le trajet. Elle a besoin du nom
-- (français si connu) et de la position de chaque ville, dans l'ordre du voyage : nouvelle clé `stops` dans la réponse
-- de `shared_trip`, et la ville de chaque jour en français quand on la connaît. Le reste est inchangé ; toujours lisible sans compte, avec le jeton du lien seulement.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 2300.
-- Sans elle l'appli marche comme avant : la page de partage affiche la planète sans le trajet.

create or replace function public.shared_trip(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', t.title,
    'starts_on', t.starts_on,
    'ends_on', t.ends_on,
    'destinations', coalesce((
      select jsonb_agg(c.name order by d.position)
      from public.trip_destinations d join public.cities c on c.id = d.city_id
      where d.trip_id = t.id), '[]'::jsonb),
    'stops', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(c.name_fr, c.name), 'lat', c.lat, 'lng', c.lng) order by d.position)
      from public.trip_destinations d join public.cities c on c.id = d.city_id
      where d.trip_id = t.id), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', td.day_date,
        'city', (select coalesce(c.name_fr, c.name) from public.cities c where c.id = td.city_id),
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'time', i.start_time,
            'name', coalesce(nullif(btrim(i.title), ''), p.name),
            'category', coalesce(i.category_code, p.category_code),
            'note', i.note
          ) order by i.start_time nulls last, i.position)
          from public.trip_items i left join public.places p on p.id = i.place_id
          where i.day_id = td.id and i.plan = 'A'), '[]'::jsonb)
      ) order by td.day_date)
      from public.trip_days td where td.trip_id = t.id), '[]'::jsonb)
  )
  from public.trip_shares s join public.trips t on t.id = s.trip_id
  where s.token = p_token and s.revoked_at is null and t.deleted_at is null;
$$;
revoke all on function public.shared_trip(text) from public;
grant execute on function public.shared_trip(text) to anon, authenticated, service_role;
