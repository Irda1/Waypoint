-- Waypoint · migration 2200 : quartiers rattachés à leur ville
--
-- GeoNames liste aussi des quartiers et arrondissements comme des villes (Setagaya et Ōta à Tokyo, Paris 15,
-- Lyon 02, Vomero à Naples…). Chacun garde sa ligne (rien n'est supprimé, les voyages qui en contiennent un
-- continuent de marcher), mais pointe maintenant vers sa ville : `parent_geonames_id` = identifiant GeoNames de
-- la ville (Tokyo). Null pour une vraie ville.
-- La carte de l'étape Villes ne montre plus que les vraies villes ; les quartiers deviennent des « Quartiers à
-- explorer » sous la ville choisie. La colonne est remplie par la collecte (passe « cities », qui repère les
-- quartiers et les rattache à la ville voisine la plus attirante).
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 2100.
-- Sans elle l'appli marche comme avant : quartiers affichés comme des villes, pas de « Quartiers à explorer ».

alter table public.cities
  add column if not exists parent_geonames_id integer;
create index if not exists cities_parent_idx on public.cities (parent_geonames_id) where parent_geonames_id is not null;
comment on column public.cities.parent_geonames_id is
  'Quartier : identifiant GeoNames de sa ville (rempli par la collecte). Null pour une vraie ville.';
