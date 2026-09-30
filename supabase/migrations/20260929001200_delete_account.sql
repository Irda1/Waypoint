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
