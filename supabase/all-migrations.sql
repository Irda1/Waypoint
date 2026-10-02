-- Waypoint · toutes les migrations, dans l'ordre (généré par scripts/bundle-sql.mjs)
-- À exécuter UNE fois sur un projet Supabase neuf : éditeur SQL > New query > Run.

-- ============================================================
-- 20260929000100_extensions_helpers.sql
-- ============================================================
-- Waypoint · migration 0100 : extensions et fonctions utilitaires
--
-- Ordre des migrations :
--   0100 extensions        0200 données de référence   0300 profils
--   0400 voyages           0500 sécurité (RLS)         0600 temps réel + fonctions (RPC)
--   0700 PostGIS (recherche par rayon)
--
-- Toutes les fonctions utilisent `set search_path = ''` : chaque objet est
-- qualifié (public.xxx, auth.xxx), ce qui évite le détournement de schéma.

create schema if not exists extensions;

-- Recherche de noms tolérante aux fautes (index trigramme sur places.name)
create extension if not exists pg_trgm with schema extensions;

-- Horodatage générique utilisé par les tables de référence
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================
-- 20260929000200_reference_data.sql
-- ============================================================
-- Waypoint · migration 0200 : données de référence (pays, villes, lieux, médias)
--
-- Ces tables sont lisibles par tout le monde (même sans compte) et écrites
-- uniquement par le pipeline de collecte, avec la clé de service (qui contourne
-- la sécurité par ligne). Chaque ligne garde sa source, sa licence et sa date de
-- collecte : c'est ce qui permet d'afficher les mentions obligatoires et de
-- retirer une source à risque avant une commercialisation.

-- ---------------------------------------------------------------------------
-- Médias (photos) : liens vers le fournisseur + crédit obligatoire (Pexels...)
-- ---------------------------------------------------------------------------
create table public.media (
  id            bigint generated always as identity primary key,
  provider      text not null check (provider in ('pexels', 'wikimedia', 'unsplash', 'user', 'other')),
  provider_id   text not null,
  url_small     text,
  url_medium    text,
  url_large     text,
  page_url      text,                 -- lien vers la page du fournisseur (obligatoire pour Pexels)
  author        text,
  author_url    text,
  attribution   text,                 -- texte prêt à afficher : « Photo : X / Pexels »
  license       text not null,
  width         integer,
  height        integer,
  avg_color     text,                 -- couleur moyenne, pour un fond pendant le chargement
  retrieved_at  timestamptz not null default now(),
  unique (provider, provider_id)
);

-- ---------------------------------------------------------------------------
-- Pays
-- ---------------------------------------------------------------------------
create table public.countries (
  code            char(2) primary key,            -- ISO 3166-1 alpha-2
  iso3            char(3) unique,
  name_fr         text not null,
  name_en         text not null,
  name_native     text,
  capital         text,
  region          text,
  subregion       text,
  currency_codes  text[] not null default '{}',   -- ISO 4217
  languages       text[] not null default '{}',   -- ISO 639
  timezones       text[] not null default '{}',   -- noms IANA
  calling_code    text,
  flag_emoji      text,
  flag_url        text,
  lat             double precision,
  lng             double precision,
  population      bigint,
  geonames_id     integer unique,
  wikidata_id     text unique,
  cover_media_id  bigint references public.media (id) on delete set null,
  source          text not null,
  license         text not null,
  source_url      text,
  retrieved_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger countries_updated_at before update on public.countries
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Villes. `collection_status` pilote la collecte à la demande des lieux.
-- ---------------------------------------------------------------------------
create table public.cities (
  id                   bigint generated always as identity primary key,
  country_code         char(2) not null references public.countries (code) on delete cascade,
  name                 text not null,
  name_ascii           text,
  name_fr              text,
  admin1               text,                       -- région / préfecture
  lat                  double precision not null check (lat between -90 and 90),
  lng                  double precision not null check (lng between -180 and 180),
  population           integer,
  timezone             text,
  is_capital           boolean not null default false,
  geonames_id          integer unique,
  wikidata_id          text unique,
  cover_media_id       bigint references public.media (id) on delete set null,
  collection_status    text not null default 'empty'
                       check (collection_status in ('empty', 'queued', 'collecting', 'ready', 'failed')),
  places_collected_at  timestamptz,
  source               text not null,
  license              text not null,
  source_url           text,
  retrieved_at         timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index cities_country_idx on public.cities (country_code);
create index cities_name_trgm on public.cities using gin (lower(name) extensions.gin_trgm_ops);
create index cities_population_idx on public.cities (population desc nulls last);
create trigger cities_updated_at before update on public.cities
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Catégories de lieux. Une table plutôt qu'une contrainte fixe : ajouter une
-- catégorie = ajouter une ligne, sans migration (« les catégories doivent
-- pouvoir évoluer »). Les codes reprennent ceux de la maquette.
-- ---------------------------------------------------------------------------
create table public.place_categories (
  code         text primary key,
  kind         text not null check (kind in ('activity', 'service', 'lodging', 'transit')),
  parent_code  text references public.place_categories (code) on delete restrict,
  name_fr      text not null,
  name_en      text not null,
  icon         text,
  sort_order   integer not null default 0,
  unique (code, kind)
);

insert into public.place_categories (code, kind, parent_code, name_fr, name_en, icon, sort_order) values
  -- Activités (catégories de la maquette)
  ('culture',      'activity', null, 'Culture',        'Culture',        'culture',      10),
  ('gastronomie',  'activity', null, 'Gastronomie',    'Food & drink',   'gastronomie',  20),
  ('nature',       'activity', null, 'Nature',         'Nature',         'nature',       30),
  ('sorties',      'activity', null, 'Divertissement', 'Entertainment',  'sorties',      40),
  ('shopping',     'activity', null, 'Shopping',       'Shopping',       'shopping',     50),
  ('creatif',      'activity', null, 'Créatif',        'Creative',       'creatif',      60),
  ('sport',        'activity', null, 'Sport',          'Sport',          'sport',        70),
  ('bienetre',     'activity', null, 'Bien-être',      'Wellness',       'bienetre',     80),
  ('nocturne',     'activity', null, 'Vie nocturne',   'Nightlife',      'nocturne',     90),
  -- Services utiles (filtre « Pratique » de la carte, hors itinéraire)
  ('pratique',     'service',  null, 'Pratique',       'Practical',      'pratique',    100),
  ('pharmacie',    'service',  'pratique', 'Pharmacies',    'Pharmacies',  'pharmacie',   101),
  ('banque',       'service',  'pratique', 'Banques',       'Banks',       'banque',      102),
  ('distributeur', 'service',  'pratique', 'Distributeurs', 'ATMs',        'distributeur',103),
  ('hopital',      'service',  'pratique', 'Hôpitaux',      'Hospitals',   'hopital',     104),
  ('toilettes',    'service',  'pratique', 'Toilettes',     'Toilets',     'toilettes',   105),
  ('laverie',      'service',  'pratique', 'Laveries',      'Laundries',   'laverie',     106),
  -- Hébergement et transport
  ('hebergement',  'lodging',  null, 'Hébergement',    'Lodging',        'lit',         110),
  ('transport',    'transit',  null, 'Transport',      'Transport',      'metro',       120);

insert into public.place_categories (code, kind, parent_code, name_fr, name_en, icon, sort_order) values
  -- Sous-catégories d'activités (repères pour le tri des données OpenStreetMap)
  ('musee',          'activity', 'culture',     'Musées',          'Museums',         'culture',     11),
  ('monument',       'activity', 'culture',     'Monuments',       'Monuments',       'culture',     12),
  ('temple',         'activity', 'culture',     'Temples',         'Temples',         'culture',     13),
  ('galerie',        'activity', 'culture',     'Galeries',        'Galleries',       'culture',     14),
  ('restaurant',     'activity', 'gastronomie', 'Restaurants',     'Restaurants',     'gastronomie', 21),
  ('cafe',           'activity', 'gastronomie', 'Cafés',           'Cafés',           'gastronomie', 22),
  ('street_food',    'activity', 'gastronomie', 'Street food',     'Street food',     'gastronomie', 23),
  ('marche',         'activity', 'gastronomie', 'Marchés',         'Markets',         'gastronomie', 24),
  ('parc',           'activity', 'nature',      'Parcs et jardins','Parks & gardens', 'nature',      31),
  ('plage',          'activity', 'nature',      'Plages',          'Beaches',         'nature',      32),
  ('point_de_vue',   'activity', 'nature',      'Points de vue',   'Viewpoints',      'nature',      33),
  ('cinema',         'activity', 'sorties',     'Cinémas',         'Cinemas',         'sorties',     41),
  ('arcade',         'activity', 'sorties',     'Arcades',         'Arcades',         'sorties',     42),
  ('parc_attractions','activity','sorties',     'Parcs d''attractions','Theme parks',  'sorties',     43),
  ('centre_commercial','activity','shopping',   'Centres commerciaux','Malls',         'shopping',    51),
  ('boutique',       'activity', 'shopping',    'Boutiques',       'Shops',           'shopping',    52),
  ('atelier',        'activity', 'creatif',     'Ateliers',        'Workshops',       'creatif',     61),
  ('spa',            'activity', 'bienetre',    'Spas et onsens',  'Spas & onsen',    'bienetre',    81),
  ('bar',            'activity', 'nocturne',    'Bars',            'Bars',            'nocturne',    91),
  ('club',           'activity', 'nocturne',    'Clubs',           'Clubs',           'nocturne',    92),
  -- Transports (sous-catégories)
  ('gare',           'transit',  'transport',   'Gares',           'Train stations',  'metro',       121),
  ('metro',          'transit',  'transport',   'Métro et tram',   'Metro & tram',    'metro',       122),
  ('aeroport',       'transit',  'transport',   'Aéroports',       'Airports',        'metro',       123);

-- ---------------------------------------------------------------------------
-- Lieux : activités, services utiles, hébergements, arrêts de transport
-- ---------------------------------------------------------------------------
create table public.places (
  id                   bigint generated always as identity primary key,
  city_id              bigint not null references public.cities (id) on delete cascade,
  kind                 text not null check (kind in ('activity', 'service', 'lodging', 'transit')),
  category_code        text not null,
  name                 text not null check (length(btrim(name)) > 0),
  name_local           text,                       -- nom dans la langue du pays (japonais...)
  description          text,
  address              text,
  lat                  double precision not null check (lat between -90 and 90),
  lng                  double precision not null check (lng between -180 and 180),
  opening_hours        text,                       -- format OpenStreetMap opening_hours, tel quel
  closed_days          smallint[] not null default '{}',   -- 0 = dimanche ... 6 = samedi
  visit_duration_min   integer check (visit_duration_min between 0 and 1440),
  duration_is_estimate boolean not null default true,      -- déduite de la catégorie : jamais « officielle »
  price_amount         numeric(10, 2) check (price_amount >= 0),
  price_currency       char(3),
  price_level          smallint check (price_level between 0 and 4),
  price_is_estimate    boolean not null default true,
  website              text,
  phone                text,
  popularity           real not null default 0 check (popularity >= 0),  -- classe les suggestions
  osm_type             text check (osm_type in ('node', 'way', 'relation')),
  osm_id               bigint,
  wikidata_id          text,
  google_place_id      text,                       -- identifiant stockable sans limite de durée
  cover_media_id       bigint references public.media (id) on delete set null,
  tags                 jsonb not null default '{}'::jsonb,  -- étiquettes brutes utiles (cuisine, accès...)
  status               text not null default 'active' check (status in ('active', 'hidden')),
  source               text not null,
  license              text not null,
  source_url           text,
  retrieved_at         timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- la catégorie doit appartenir au même type que le lieu (activité, service...)
  foreign key (category_code, kind) references public.place_categories (code, kind),
  check ((osm_type is null) = (osm_id is null))
);
-- Index uniques NON partiels : l'API REST (upsert `on_conflict=osm_type,osm_id`) ne sait pas
-- viser un index partiel. Les valeurs NULL ne sont jamais en conflit entre elles.
create unique index places_osm_uniq on public.places (osm_type, osm_id);
create unique index places_google_uniq on public.places (google_place_id);
create index places_city_kind_idx on public.places (city_id, kind, category_code) where status = 'active';
create index places_city_popularity_idx on public.places (city_id, popularity desc) where status = 'active';
create index places_name_trgm on public.places using gin (lower(name) extensions.gin_trgm_ops);
create index places_wikidata_idx on public.places (wikidata_id) where wikidata_id is not null;
create trigger places_updated_at before update on public.places
  for each row execute function public.tg_set_updated_at();

-- Provenance détaillée (un lieu peut venir de plusieurs sources) :
-- « quelle source, quand, quelle licence, quel risque ».
create table public.place_sources (
  id            bigint generated always as identity primary key,
  place_id      bigint not null references public.places (id) on delete cascade,
  source        text not null,
  external_id   text,
  license       text not null,
  license_risk  text not null default 'ok' check (license_risk in ('ok', 'a_verifier', 'risque')),
  retrieved_at  timestamptz not null default now(),
  run_id        bigint,
  unique (place_id, source)
);
create index place_sources_risk_idx on public.place_sources (license_risk) where license_risk <> 'ok';

-- ---------------------------------------------------------------------------
-- Journal des passes de collecte et file d'attente (serveur uniquement)
-- ---------------------------------------------------------------------------
create table public.ingestion_runs (
  id            bigint generated always as identity primary key,
  pass          text not null,                 -- countries | cities | places | images | enrich
  source        text not null,
  scope         text,                          -- ex. « city:123 » ou « all »
  status        text not null default 'running' check (status in ('running', 'done', 'failed')),
  rows_read     integer not null default 0,
  rows_kept     integer not null default 0,
  rows_written  integer not null default 0,
  license       text,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

alter table public.place_sources
  add constraint place_sources_run_fk foreign key (run_id) references public.ingestion_runs (id) on delete set null;

-- File d'attente : « la première fois qu'un voyage cible une ville pas encore
-- remplie, une tâche la met en file ». Une seule tâche à la fois par ville.
create table public.ingestion_queue (
  id            bigint generated always as identity primary key,
  city_id       bigint not null references public.cities (id) on delete cascade,
  pass          text not null default 'places' check (pass in ('places', 'images', 'enrich')),
  status        text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  priority      integer not null default 0,
  attempts      integer not null default 0,
  requested_by  uuid,
  requested_at  timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  error         text
);
create unique index ingestion_queue_active_uniq on public.ingestion_queue (city_id, pass)
  where status in ('queued', 'running');
create index ingestion_queue_pick_idx on public.ingestion_queue (pass, priority desc, requested_at)
  where status = 'queued';

-- ============================================================
-- 20260929000300_profiles.sql
-- ============================================================
-- Waypoint · migration 0300 : profils
--
-- Les comptes (email + mot de passe, Google) vivent dans auth.users, géré par
-- l'authentification de Supabase : l'app ne stocke jamais de mot de passe.
-- `profiles` ne garde que ce que l'app affiche.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default 'Voyageur' check (length(btrim(display_name)) between 1 and 60),
  avatar_url    text,
  home_country  char(2) references public.countries (code) on delete set null,
  locale        text not null default 'fr',
  currency      char(3) not null default 'EUR',
  accent        text not null default 'soleil' check (accent in ('soleil', 'turquoise', 'corail', 'lavande')),
  theme         text not null default 'auto' check (theme in ('auto', 'nuit', 'jour')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Création automatique du profil à l'inscription (email ou Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  )), '');

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(v_name, 'Voyageur'), 60),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 20260929000400_trips.sql
-- ============================================================
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

-- ============================================================
-- 20260929000500_rls.sql
-- ============================================================
-- Waypoint · migration 0500 : sécurité par ligne (RLS)
--
-- Règles :
--  * données de référence : lecture publique, aucune écriture depuis l'app
--    (le pipeline utilise la clé de service, qui contourne la RLS) ;
--  * voyage et tout ce qui s'y rattache : lisible et modifiable par ses membres
--    actifs, tous à égalité (aucun rôle) ;
--  * on rejoint un voyage uniquement par une invitation valide (fonction join_trip) ;
--  * file de collecte et journaux de collecte : jamais accessibles à l'app.

-- ---------------------------------------------------------------------------
-- Fonctions d'aide (SECURITY DEFINER : elles lisent trip_members sans passer
-- par la RLS de cette table, ce qui évite toute récursion de politiques)
-- ---------------------------------------------------------------------------
create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip
      and m.user_id = (select auth.uid())
      and m.left_at is null
  );
$$;

-- Vrai si l'utilisateur courant partage (ou a partagé) un voyage avec `p_other`.
create or replace function public.shares_trip_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members me
    join public.trip_members other on other.trip_id = me.trip_id
    where me.user_id = (select auth.uid())
      and me.left_at is null
      and other.user_id = p_other
  );
$$;

revoke all on function public.is_trip_member(uuid) from public, anon;
revoke all on function public.shares_trip_with(uuid) from public, anon;
grant execute on function public.is_trip_member(uuid) to authenticated, service_role;
grant execute on function public.shares_trip_with(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Activation de la RLS sur toutes les tables
-- ---------------------------------------------------------------------------
alter table public.media              enable row level security;
alter table public.countries          enable row level security;
alter table public.cities             enable row level security;
alter table public.place_categories   enable row level security;
alter table public.places             enable row level security;
alter table public.place_sources      enable row level security;
alter table public.ingestion_runs     enable row level security;
alter table public.ingestion_queue    enable row level security;
alter table public.profiles           enable row level security;
alter table public.trips              enable row level security;
alter table public.trip_members       enable row level security;
alter table public.trip_invites       enable row level security;
alter table public.trip_stays         enable row level security;
alter table public.trip_days          enable row level security;
alter table public.trip_items         enable row level security;
alter table public.expenses           enable row level security;
alter table public.trip_budget_lines  enable row level security;
alter table public.saved_places       enable row level security;
alter table public.trip_activity_log  enable row level security;

-- ---------------------------------------------------------------------------
-- Données de référence : lecture publique
-- ---------------------------------------------------------------------------
create policy "lecture publique" on public.media            for select to anon, authenticated using (true);
create policy "lecture publique" on public.countries        for select to anon, authenticated using (true);
create policy "lecture publique" on public.cities           for select to anon, authenticated using (true);
create policy "lecture publique" on public.place_categories for select to anon, authenticated using (true);
create policy "lecture publique" on public.places           for select to anon, authenticated using (status = 'active');
create policy "lecture publique" on public.place_sources    for select to anon, authenticated using (true);
-- ingestion_runs et ingestion_queue : aucune politique = aucun accès pour l'app.

-- Défense en profondeur : retirer aussi les droits SQL, pas seulement les politiques.
revoke all on public.ingestion_runs, public.ingestion_queue from anon, authenticated;
revoke insert, update, delete, truncate on
  public.media, public.countries, public.cities, public.place_categories,
  public.places, public.place_sources
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profils : le sien, et ceux des personnes avec qui on partage un voyage
-- ---------------------------------------------------------------------------
create policy "profil visible" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_trip_with(id));
create policy "profil modifiable par soi" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Pas d'insertion (trigger sur auth.users) ni de suppression (cascade depuis auth.users).
revoke insert, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;

-- ---------------------------------------------------------------------------
-- Voyages
-- ---------------------------------------------------------------------------
-- `created_by` dans la lecture : juste après la création, le créateur n'est pas
-- encore membre au moment du RETURNING ; il doit pouvoir relire sa ligne.
create policy "voyage visible" on public.trips for select to authenticated
  using (created_by = (select auth.uid()) or public.is_trip_member(id));
create policy "voyage créé par soi" on public.trips for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "voyage modifiable par un membre" on public.trips for update to authenticated
  using (public.is_trip_member(id)) with check (public.is_trip_member(id));
-- Pas de suppression définitive côté app : corbeille via deleted_at.
revoke delete on public.trips from authenticated;
revoke all on public.trips from anon;

-- Membres : on voit les membres de ses voyages ; on ne modifie que sa propre ligne
-- (couleur, départ). Les ajouts passent par join_trip / le trigger du créateur.
create policy "membres visibles" on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id) or user_id = (select auth.uid()));
create policy "sa ligne de membre" on public.trip_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, delete on public.trip_members from authenticated;
revoke all on public.trip_members from anon;

-- Invitations : gérées par les membres ; utilisées via join_trip (SECURITY DEFINER).
create policy "invitations des membres" on public.trip_invites for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "créer une invitation" on public.trip_invites for insert to authenticated
  with check (public.is_trip_member(trip_id));
create policy "révoquer une invitation" on public.trip_invites for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "supprimer une invitation" on public.trip_invites for delete to authenticated
  using (public.is_trip_member(trip_id));
revoke all on public.trip_invites from anon;

-- ---------------------------------------------------------------------------
-- Contenu du voyage : tout membre lit, crée, modifie et supprime
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['trip_stays', 'trip_days', 'trip_items', 'expenses', 'trip_budget_lines', 'saved_places']
  loop
    execute format('create policy "membres : lecture" on public.%I for select to authenticated using (public.is_trip_member(trip_id))', t);
    execute format('create policy "membres : ajout" on public.%I for insert to authenticated with check (public.is_trip_member(trip_id))', t);
    execute format('create policy "membres : modification" on public.%I for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id))', t);
    execute format('create policy "membres : suppression" on public.%I for delete to authenticated using (public.is_trip_member(trip_id))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Journal : lecture par les membres ; écrit uniquement par les triggers.
create policy "journal visible" on public.trip_activity_log for select to authenticated
  using (public.is_trip_member(trip_id));
revoke insert, update, delete, truncate on public.trip_activity_log from anon, authenticated;
revoke all on public.trip_activity_log from anon;

-- ---------------------------------------------------------------------------
-- Fonctions de trigger : jamais appelables par l'app
-- ---------------------------------------------------------------------------
revoke all on function
  public.handle_new_user(),
  public.tg_set_updated_at(),
  public.tg_row_meta(),
  public.tg_trip_creator_member(),
  public.tg_expense_payer_is_member(),
  public.tg_activity_log()
  from public, anon, authenticated;

-- ============================================================
-- 20260929000600_realtime_rpc.sql
-- ============================================================
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

-- ============================================================
-- 20260929000700_postgis.sql
-- ============================================================
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

-- ============================================================
-- 20260929000800_trip_destinations.sql
-- ============================================================
-- Waypoint · migration 0800 : destinations d'un voyage
--
-- Un voyage peut avoir plusieurs destinations (villes de la base). Elles servent à proposer
-- directement les bonnes villes dans le sélecteur de lieux, et à illustrer la couverture.
-- Même règle que le reste du voyage : tout membre lit, ajoute et retire, sans rôle.

create table public.trip_destinations (
  trip_id     uuid not null references public.trips (id) on delete cascade,
  city_id     bigint not null references public.cities (id) on delete cascade,
  position    integer not null default 0,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (trip_id, city_id)
);
create index trip_destinations_city_idx on public.trip_destinations (city_id);

alter table public.trip_destinations enable row level security;

create policy "membres : lecture" on public.trip_destinations for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.trip_destinations for insert to authenticated
  with check (public.is_trip_member(trip_id));
create policy "membres : modification" on public.trip_destinations for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "membres : suppression" on public.trip_destinations for delete to authenticated
  using (public.is_trip_member(trip_id));
revoke all on public.trip_destinations from anon;

-- Temps réel (Supabase uniquement, comme la migration 0600)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_destinations') then
    alter publication supabase_realtime add table public.trip_destinations;
  end if;
end $$;

-- ============================================================
-- 20260929000900_wizard_trip_fields.sql
-- ============================================================
-- Waypoint · migration 0900 : champs du parcours « Démarrer un voyage »
--
-- Le parcours de la maquette (pays, dates, villes avec nuits, voyageurs, envies, budget) enregistre :
--  * le pays du voyage, le nombre de voyageurs et le type de groupe ;
--  * l'indication « dates indicatives » quand seule une durée a été choisie ;
--  * le nombre de nuits de chaque destination (répartition automatique, ajustable) ;
--  * les villes phares, dans l'ordre d'affichage voulu (null = ville ordinaire).

alter table public.cities
  add column featured_rank smallint;
create index cities_featured_idx on public.cities (country_code, featured_rank) where featured_rank is not null;

alter table public.trips
  add column country_code char(2) check (country_code ~ '^[A-Z]{2}$'),
  add column travelers smallint not null default 1 check (travelers between 1 and 30),
  add column party_type text check (party_type in ('seul', 'deux', 'amis', 'famille')),
  add column dates_indicative boolean not null default false;

alter table public.trip_destinations
  add column nights smallint not null default 0 check (nights between 0 and 365);

-- ============================================================
-- 20260929001000_exchange_rates.sql
-- ============================================================
-- Waypoint · migration 1000 : taux de change
--
-- Taux du jour de la Banque centrale européenne, via l'API Frankfurter (sans clé), collectés par la passe
-- `rates` du pipeline (clé de service). Tous les taux sont exprimés pour 1 EUR : convertir A -> B, c'est
-- montant / taux(A) * taux(B). Lecture publique, aucune écriture depuis l'app.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 0900.

create table public.exchange_rates (
  base        char(3) not null default 'EUR' check (base = 'EUR'),
  quote       char(3) not null check (quote ~ '^[A-Z]{3}$'),
  rate        numeric(18, 8) not null check (rate > 0),
  rate_date   date not null,                      -- date de publication du taux (jour ouvré BCE)
  fetched_at  timestamptz not null default now(),
  source      text not null default 'frankfurter.dev (BCE)',
  primary key (base, quote)
);

alter table public.exchange_rates enable row level security;
create policy "lecture publique" on public.exchange_rates for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.exchange_rates from anon, authenticated;

-- La passe `rates` est journalisée dans ingestion_runs (colonne pass = texte libre).

-- ============================================================
-- 20260929001100_settlement_payments.sql
-- ============================================================
-- Waypoint · migration 1100 : remboursements entre amis
--
-- « Marquer reçu » : quand un ami rembourse une part, on l'enregistre ici. Les soldes de l'écran « Entre amis »
-- en tiennent compte (celui qui rembourse voit sa dette baisser, celui qui reçoit voit sa créance baisser).
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1000.

create table public.settlement_payments (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  from_user   uuid not null references public.profiles (id) on delete cascade,   -- celui qui rembourse
  to_user     uuid not null references public.profiles (id) on delete cascade,   -- celui qui reçoit
  amount      numeric(12, 2) not null check (amount > 0),
  currency    char(3) not null default 'EUR',
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (from_user <> to_user)
);
create index settlement_payments_trip_idx on public.settlement_payments (trip_id, created_at);

alter table public.settlement_payments enable row level security;
create policy "membres : lecture" on public.settlement_payments for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.settlement_payments for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "membres : suppression" on public.settlement_payments for delete to authenticated using (public.is_trip_member(trip_id));
revoke update, truncate on public.settlement_payments from authenticated;
revoke all on public.settlement_payments from anon;

-- Mise à jour en direct chez les autres membres (Supabase uniquement).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settlement_payments') then
    alter publication supabase_realtime add table public.settlement_payments;
  end if;
end $$;

-- ============================================================
-- 20260929001200_delete_account.sql
-- ============================================================
-- Waypoint · migration 1200 : suppression de son propre compte
--
-- Bouton « Supprimer mon compte » des Paramètres (obligatoire pour les boutiques d'applications).
-- Les voyages dont la personne est la seule voyageuse sont supprimés avec tout leur contenu ; dans les
-- voyages partagés, ses dépenses restent (sans nom) et elle disparaît de la liste des voyageurs.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1100.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;

  -- Voyages où personne d'autre n'est encore membre : supprimés (le reste suit en cascade).
  delete from public.trips t
  where exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = v_uid)
    and not exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id <> v_uid and m.left_at is null);

  -- Le compte ; le profil et les appartenances partent en cascade, les auteurs passent à « inconnu ».
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
-- 20260929001300_trip_bookings.sql
-- ============================================================
-- Waypoint · migration 1300 : réservations du voyage
--
-- Vols, trains, hébergements, billets d'activité : un titre, un numéro de confirmation, une date et une heure,
-- un lien (billet en ligne, PDF hébergé ailleurs) et des notes. Visibles et modifiables par tous les voyageurs.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1200.

create table public.trip_bookings (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  kind        text not null default 'autre' check (kind in ('vol', 'train', 'hebergement', 'activite', 'autre')),
  title       text not null check (char_length(title) between 1 and 120),
  reference   text check (char_length(reference) <= 80),
  starts_on   date,
  start_time  text check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  url         text check (char_length(url) <= 500),
  notes       text check (char_length(notes) <= 1000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index trip_bookings_trip_idx on public.trip_bookings (trip_id, starts_on);

alter table public.trip_bookings enable row level security;
create policy "membres : lecture" on public.trip_bookings for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.trip_bookings for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "membres : modification" on public.trip_bookings for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "membres : suppression" on public.trip_bookings for delete to authenticated using (public.is_trip_member(trip_id));
revoke truncate on public.trip_bookings from authenticated;
revoke all on public.trip_bookings from anon;

-- ============================================================
-- 20260929001400_trip_checklist.sql
-- ============================================================
-- Waypoint · migration 1400 : liste « À ne pas oublier » du voyage
--
-- Bagages, papiers, démarches : des lignes à cocher, partagées entre les voyageurs du voyage.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1300.

create table public.trip_checklist (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 120),
  done        boolean not null default false,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index trip_checklist_trip_idx on public.trip_checklist (trip_id, created_at);

alter table public.trip_checklist enable row level security;
create policy "membres : lecture" on public.trip_checklist for select to authenticated using (public.is_trip_member(trip_id));
create policy "membres : ajout" on public.trip_checklist for insert to authenticated with check (public.is_trip_member(trip_id));
create policy "membres : modification" on public.trip_checklist for update to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "membres : suppression" on public.trip_checklist for delete to authenticated using (public.is_trip_member(trip_id));
revoke truncate on public.trip_checklist from authenticated;
revoke all on public.trip_checklist from anon;

-- ============================================================
-- 20260929001500_trip_shares.sql
-- ============================================================
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

-- ============================================================
-- 20260929001600_client_collection.sql
-- ============================================================
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
