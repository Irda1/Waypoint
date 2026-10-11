-- Waypoint · migration 2100 : « Supprimer mon compte » marche aussi dans un voyage partagé
--
-- Bug corrigé : la suppression échouait pour une personne encore dans un voyage partagé. En effaçant son
-- profil, la base vide l'auteur (created_by, updated_by) des lignes qu'elle a créées et la retire des
-- voyageurs ; mais les déclencheurs remettaient aussitôt l'auteur d'origine, la notaient comme dernière
-- autrice et l'inscrivaient au journal, alors que son profil n'existait plus : la base refusait tout.
-- Désormais, une personne dont le profil n'existe plus n'est plus jamais notée comme autrice (« inconnu »).
-- Rien ne change pour les autres modifications.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 2000.

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
  -- Compte en cours de suppression : son profil n'existe plus, il ne peut plus être auteur.
  if v_uid is not null and not exists (select 1 from public.profiles p where p.id = v_uid) then
    v_uid := null;
  end if;
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
    -- l'auteur d'origine ne se réécrit pas ; il ne s'efface que si son compte a été supprimé
    if new.created_by is not null or exists (select 1 from public.profiles p where p.id = old.created_by) then
      new.created_by := old.created_by;
    end if;
    new.created_at := old.created_at;
    new.updated_at := now();
    if v_uid is not null then
      new.updated_by := v_uid;
    end if;
  end if;
  return new;
end;
$$;

-- Journal des modifications : l'auteur n'est noté que si son profil existe encore.
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
    (select p.id from public.profiles p where p.id = auth.uid()),
    tg_table_name,
    coalesce(v_ref ->> 'id', v_ref ->> 'user_id', v_ref ->> 'place_id', v_ref ->> 'poste'),
    lower(tg_op),
    v_old,
    v_new
  );
  return null;
end;
$$;
