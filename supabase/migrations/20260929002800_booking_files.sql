-- Waypoint · migration 2800 : billets joints aux réservations (PDF et photos)
--
-- Chaque réservation (table trip_bookings, migration 1300) peut recevoir jusqu'à 5 fichiers : carte d'embarquement,
-- voucher d'hôtel, billet d'entrée. Table `trip_booking_files` (une ligne par fichier), réservée aux membres du voyage.
-- Les fichiers sont rangés dans un espace de stockage PRIVÉ « trip-files », sous `<voyage>/<réservation>/<fichier>` :
-- seuls les membres du voyage peuvent les voir ou en ajouter, et chacun ne supprime que les siens.
-- PDF, JPEG, PNG ou WebP, 10 Mo au plus. Supprimer la réservation supprime les lignes de ses fichiers.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 2700
-- (elle réutilise la fonction photo_trip_member de la migration 2600).
-- Sans elle l'appli marche comme avant : la zone « Billets » des réservations ne s'affiche pas.

-- Un fichier doit appartenir à une réservation du même voyage (clé étrangère sur le couple).
alter table public.trip_bookings add constraint trip_bookings_id_trip_key unique (id, trip_id);

create table public.trip_booking_files (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  booking_id    uuid not null,
  path          text not null unique check (split_part(path, '/', 1) = trip_id::text and split_part(path, '/', 2) = booking_id::text),
  name          text not null check (char_length(name) between 1 and 160),
  size          integer check (size between 1 and 10485760),
  content_type  text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  foreign key (booking_id, trip_id) references public.trip_bookings (id, trip_id) on delete cascade
);
create index trip_booking_files_idx on public.trip_booking_files (trip_id, booking_id, created_at);

-- Auteur imposé, et au plus 5 fichiers par réservation.
create or replace function public.tg_booking_file_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := auth.uid();
  if (select count(*) from public.trip_booking_files f where f.booking_id = new.booking_id) >= 5 then
    raise exception 'Au plus 5 fichiers par réservation.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trip_booking_files_insert before insert on public.trip_booking_files
  for each row execute function public.tg_booking_file_insert();

alter table public.trip_booking_files enable row level security;
create policy "membres : lecture" on public.trip_booking_files for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.trip_booking_files for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "auteur : suppression" on public.trip_booking_files for delete to authenticated
  using (public.is_trip_member(trip_id) and created_by = (select auth.uid()));
revoke update, truncate on public.trip_booking_files from authenticated;
revoke all on public.trip_booking_files from anon;

-- ---------------------------------------------------------------------------
-- Stockage privé des billets : « trip-files/<voyage>/<réservation>/<fichier> »
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-files', 'trip-files', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Le premier dossier du chemin est l'identifiant du voyage (même règle que les photos du carnet).
create policy "billets : lecture" on storage.objects for select to authenticated
  using (bucket_id = 'trip-files' and public.photo_trip_member(name));
create policy "billets : ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-files' and public.photo_trip_member(name));
create policy "billets : suppression de ses fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-files' and owner_id = (select auth.uid())::text and public.photo_trip_member(name));
