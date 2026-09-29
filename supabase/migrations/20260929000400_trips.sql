-- Waypoint · migration 0400 : voyages partagés
--
-- Principes :
--  * tous les membres d'un voyage sont égaux : aucun rôle (admin, lecteur...) ;
--  * chaque table du voyage porte `trip_id`, ce qui rend la sécurité par ligne
--    simple et permet de filtrer le temps réel (trip_id = eq.<voyage>) ;
--  * concurrence : la dernière modification gagne, champ par champ (le client
--    n'envoie que les champs modifiés) ; chaque ligne a un numéro de version
--    et le journal `trip_activity_log` permet de comprendre et d'annuler ;
--  * un voyage ne se supprime pas en dur côté client : `deleted_at` (corbeille).

-- ---------------------------------------------------------------------------
-- Voyages
-- ---------------------------------------------------------------------------
create table public.trips (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(btrim(title)) between 1 and 120),
  starts_on       date,
  ends_on         date,
  currency        char(3) not null default 'EUR',
  budget_level    text check (budget_level in ('economique', 'moyen', 'confortable', 'premium')),
  budget_total    numeric(12, 2) check (budget_total >= 0),
  styles          text[] not null default '{}',     -- types de voyage : culturel, gastronomique...
  memo            text not null default '',
  cover_media_id  bigint references public.media (id) on delete set null,
  deleted_at      timestamptz,
  version         integer not null default 1,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index trips_created_by_idx on public.trips (created_by);

-- ---------------------------------------------------------------------------
-- Membres : tous égaux. `left_at` = a quitté le voyage (les dépenses qu'il a
-- avancées restent attribuées à son nom).
-- ---------------------------------------------------------------------------
create table public.trip_members (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  color      text not null default '#FFB95A',
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members (user_id) where left_at is null;

-- Invitations par lien ou code
create table public.trip_invites (
  code        text primary key default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  expires_at  timestamptz not null default now() + interval '14 days',
  max_uses    integer check (max_uses > 0),
  uses        integer not null default 0,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index trip_invites_trip_idx on public.trip_invites (trip_id);

-- ---------------------------------------------------------------------------
-- Hébergements. Le prix payé n'est PAS ici : c'est une dépense (expenses.stay_id),
-- comme dans la maquette, pour ne jamais compter deux fois le même paiement.
-- ---------------------------------------------------------------------------
create table public.trip_stays (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  city_id     bigint references public.cities (id) on delete set null,
  place_id    bigint references public.places (id) on delete set null,
  name        text not null default '',
  address     text,
  lat         double precision,
  lng         double precision,
  note        text,
  version     integer not null default 1,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, trip_id)
);
create index trip_stays_trip_idx on public.trip_stays (trip_id);

-- Jours. `stay_id` = hébergement de la nuit (les jours d'un séjour s'en déduisent).
create table public.trip_days (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  day_date     date not null,
  city_id      bigint references public.cities (id) on delete set null,
  stay_id      uuid,
  depart_time  time,
  return_time  time,
  version      integer not null default 1,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, trip_id),
  unique (trip_id, day_date),
  -- le séjour doit appartenir au même voyage ; supprimé, il libère seulement stay_id
  foreign key (stay_id, trip_id) references public.trip_stays (id, trip_id) on delete set null (stay_id)
);
create index trip_days_trip_idx on public.trip_days (trip_id, day_date);

-- Étapes d'un jour. Plans A / B / C (plan B = alternative en cas de pluie...).
-- `position` est un nombre décimal : glisser une étape entre deux autres ne
-- réécrit qu'une seule ligne (milieu des deux positions voisines).
create table public.trip_items (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  day_id        uuid not null,
  plan          text not null default 'A' check (plan in ('A', 'B', 'C')),
  place_id      bigint references public.places (id) on delete set null,
  title         text,                       -- titre libre si l'étape n'est pas un lieu de la base
  category_code text references public.place_categories (code),
  start_time    time,
  duration_min  integer check (duration_min between 0 and 1440),
  position      double precision not null default 0,
  done          boolean not null default false,
  note          text,
  version       integer not null default 1,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, trip_id),
  check (place_id is not null or nullif(btrim(title), '') is not null),
  foreign key (day_id, trip_id) references public.trip_days (id, trip_id) on delete cascade
);
create index trip_items_day_idx on public.trip_items (day_id, plan, position);
create index trip_items_trip_idx on public.trip_items (trip_id);

-- Dépenses : partagées à parts égales entre les membres (calcul côté app,
-- comme dans la maquette). `item_id` / `stay_id` relient un paiement à une
-- étape ou à un hébergement (pastille dollar, budget Hébergement).
create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  label       text not null check (length(btrim(label)) > 0),
  poste       text not null check (poste in ('hebergement', 'transports', 'repas', 'activites', 'shopping')),
  amount      numeric(12, 2) not null check (amount >= 0),
  currency    char(3) not null default 'EUR',
  paid_by     uuid references public.profiles (id) on delete set null,
  spent_on    date not null default current_date,
  item_id     uuid,
  stay_id     uuid,
  note        text,
  version     integer not null default 1,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (item_id, trip_id) references public.trip_items (id, trip_id) on delete set null (item_id),
  foreign key (stay_id, trip_id) references public.trip_stays (id, trip_id) on delete set null (stay_id)
);
create index expenses_trip_idx on public.expenses (trip_id, spent_on);
create index expenses_item_idx on public.expenses (item_id) where item_id is not null;
create index expenses_stay_idx on public.expenses (stay_id) where stay_id is not null;

-- Budget prévu par poste
create table public.trip_budget_lines (
  trip_id     uuid not null references public.trips (id) on delete cascade,
  poste       text not null check (poste in ('hebergement', 'transports', 'repas', 'activites', 'shopping')),
  amount      numeric(12, 2) not null default 0 check (amount >= 0),
  version     integer not null default 1,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (trip_id, poste)
);

-- Lieux enregistrés : favoris et « non prévu » (idées à caser)
create table public.saved_places (
  trip_id   uuid not null references public.trips (id) on delete cascade,
  place_id  bigint not null references public.places (id) on delete cascade,
  list      text not null check (list in ('favorite', 'unplanned')),
  added_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  added_at  timestamptz not null default now(),
  primary key (trip_id, place_id, list)
);

-- ---------------------------------------------------------------------------
-- Journal des modifications : qui a changé quoi, quand (remplace les rôles :
-- sans hiérarchie, c'est ce qui permet de comprendre et d'annuler).
-- ---------------------------------------------------------------------------
create table public.trip_activity_log (
  id          bigint generated always as identity primary key,
  trip_id     uuid not null references public.trips (id) on delete cascade,
  actor       uuid references public.profiles (id) on delete set null,
  table_name  text not null,
  row_id      text,
  action      text not null check (action in ('insert', 'update', 'delete')),
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index trip_activity_log_trip_idx on public.trip_activity_log (trip_id, id desc);

-- ---------------------------------------------------------------------------
-- Triggers : version, auteur, intégrité, journal, propriétaire = premier membre
-- ---------------------------------------------------------------------------

-- Numéro de version, dernier auteur, et interdiction de déplacer une ligne vers
-- un autre voyage (un membre de deux voyages ne doit pas pouvoir les mélanger).
create or replace function public.tg_row_meta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if v_uid is not null then
      new.created_by := v_uid;   -- impossible d'usurper l'auteur
    end if;
    new.updated_by := coalesce(v_uid, new.created_by);
    new.version := 1;
  else
    if tg_table_name <> 'trips' then
      -- (imbriqué : PL/pgSQL ne prépare cette ligne que pour les tables qui ont trip_id)
      if new.trip_id is distinct from old.trip_id then
        raise exception 'trip_id ne peut pas être modifié' using errcode = '23514';
      end if;
    end if;
    new.version := old.version + 1;
    new.created_by := old.created_by;   -- l'auteur d'origine ne se réécrit pas
    new.created_at := old.created_at;
    new.updated_at := now();
    if v_uid is not null then
      new.updated_by := v_uid;
    end if;
  end if;
  return new;
end;
$$;

create trigger trips_meta before insert or update on public.trips
  for each row execute function public.tg_row_meta();
create trigger trip_stays_meta before insert or update on public.trip_stays
  for each row execute function public.tg_row_meta();
create trigger trip_days_meta before insert or update on public.trip_days
  for each row execute function public.tg_row_meta();
create trigger trip_items_meta before insert or update on public.trip_items
  for each row execute function public.tg_row_meta();
create trigger expenses_meta before insert or update on public.expenses
  for each row execute function public.tg_row_meta();
create trigger trip_budget_lines_meta before insert or update on public.trip_budget_lines
  for each row execute function public.tg_row_meta();

-- Le créateur d'un voyage en devient le premier membre (rien de plus : pas de rôle).
create or replace function public.tg_trip_creator_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.trip_members (trip_id, user_id)
    values (new.id, new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger trips_creator_member after insert on public.trips
  for each row execute function public.tg_trip_creator_member();

-- Une dépense ne peut être avancée que par un membre du voyage.
create or replace function public.tg_expense_payer_is_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.paid_by is not null and not exists (
    select 1 from public.trip_members m where m.trip_id = new.trip_id and m.user_id = new.paid_by
  ) then
    raise exception 'le payeur doit être membre du voyage' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger expenses_payer_member before insert or update of paid_by on public.expenses
  for each row execute function public.tg_expense_payer_is_member();

-- Journal des modifications
create or replace function public.tg_activity_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_ref jsonb := coalesce(v_new, v_old);
  v_trip uuid;
begin
  v_trip := case when tg_table_name = 'trips' then (v_ref ->> 'id')::uuid else (v_ref ->> 'trip_id')::uuid end;
  -- un voyage supprimé en cascade n'a plus de journal à alimenter
  if not exists (select 1 from public.trips t where t.id = v_trip) then
    return null;
  end if;
  insert into public.trip_activity_log (trip_id, actor, table_name, row_id, action, old_data, new_data)
  values (
    v_trip,
    auth.uid(),
    tg_table_name,
    coalesce(v_ref ->> 'id', v_ref ->> 'user_id', v_ref ->> 'place_id', v_ref ->> 'poste'),
    lower(tg_op),
    v_old,
    v_new
  );
  return null;
end;
$$;

create trigger trips_log after insert or update or delete on public.trips
  for each row execute function public.tg_activity_log();
create trigger trip_members_log after insert or update or delete on public.trip_members
  for each row execute function public.tg_activity_log();
create trigger trip_stays_log after insert or update or delete on public.trip_stays
  for each row execute function public.tg_activity_log();
create trigger trip_days_log after insert or update or delete on public.trip_days
  for each row execute function public.tg_activity_log();
create trigger trip_items_log after insert or update or delete on public.trip_items
  for each row execute function public.tg_activity_log();
create trigger expenses_log after insert or update or delete on public.expenses
  for each row execute function public.tg_activity_log();
create trigger trip_budget_lines_log after insert or update or delete on public.trip_budget_lines
  for each row execute function public.tg_activity_log();
create trigger saved_places_log after insert or update or delete on public.saved_places
  for each row execute function public.tg_activity_log();
