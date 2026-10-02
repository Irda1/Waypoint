-- Waypoint · migration 1500 : lien de partage en lecture seule
--
-- Un membre crée un lien secret ; toute personne qui l'ouvre voit le programme (jours, étapes, villes)
-- sans compte et sans rien pouvoir modifier. Ni budget, ni dépenses, ni membres ne sont exposés.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1400.

create table public.trip_shares (
  token       text primary key default replace(gen_random_uuid()::text, '-', ''),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index trip_shares_trip_idx on public.trip_shares (trip_id);

alter table public.trip_shares enable row level security;
create policy "membres : lecture" on public.trip_shares for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : création" on public.trip_shares for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "membres : révocation" on public.trip_shares for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
revoke delete, truncate on public.trip_shares from authenticated;
revoke all on public.trip_shares from anon;

-- Lecture publique : uniquement via le jeton, et seulement le programme.
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
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', td.day_date,
        'city', (select c.name from public.cities c where c.id = td.city_id),
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
