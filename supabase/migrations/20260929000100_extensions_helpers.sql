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
