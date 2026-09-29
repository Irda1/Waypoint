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
