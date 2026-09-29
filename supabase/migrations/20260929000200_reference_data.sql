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
