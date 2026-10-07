-- Waypoint · migration 1900 : mode du voyage (Complet ou Simple)
--
-- « complet » : voyage organisé jour par jour (programme, budget partagé, amis), comme avant.
-- « simple »  : une sélection de lieux dans les villes choisies (liste, carte, budget de la sélection), sans jours.
-- Tous les voyages existants restent « complet ».
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1800.
-- Sans elle l'appli marche comme avant, sans le mode Simple.

alter table public.trips
  add column if not exists mode text not null default 'complet' check (mode in ('complet', 'simple'));
