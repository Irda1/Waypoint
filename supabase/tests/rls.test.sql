-- Waypoint · tests de sécurité et d'intégrité de la base
-- Lancés par supabase/tests/run-local.sh sur un PostgreSQL local (voir le README).
-- Chaque vérification échoue bruyamment ; le script s'arrête à la première erreur.

\set ON_ERROR_STOP on
\set QUIET on

create schema if not exists test;
grant usage on schema test to anon, authenticated, service_role;

create or replace function test.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'ÉCHEC : %', p_msg;
  end if;
  raise notice 'ok   : %', p_msg;
end $$;

-- Exécute une requête et vérifie qu'elle échoue avec le SQLSTATE attendu
create or replace function test.throws(p_sql text, p_state text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then
      raise notice 'ok   : % (refusé, %)', p_msg, sqlstate;
      return;
    end if;
    raise exception 'ÉCHEC : % — erreur % au lieu de % (%)', p_msg, sqlstate, p_state, sqlerrm;
  end;
  raise exception 'ÉCHEC : % — la requête aurait dû être refusée', p_msg;
end $$;

create or replace function test.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function test.as_user(p_id uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function test.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create or replace function test.as_service() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role service_role';
end $$;

begin;

-- ===========================================================================
-- Jeu d'essai : trois utilisateurs, un lieu, une ville
-- ===========================================================================
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.test', '{"full_name": "Alice"}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@example.test',   '{"name": "Bob"}'),
  ('cccccccc-0000-0000-0000-000000000003', 'carol@example.test', '{}');

\i supabase/seed.sql

insert into public.places (id, city_id, kind, category_code, name, lat, lng, source, license)
overriding system value
select 9001, c.id, 'activity', 'musee', 'Musée d''essai', 38.72, -9.14, 'seed', 'exemple'
from public.cities c where c.name = 'Lisboa';
insert into public.places (id, city_id, kind, category_code, name, lat, lng, status, source, license)
overriding system value
select 9002, c.id, 'service', 'pharmacie', 'Pharmacie masquée', 38.73, -9.15, 'hidden', 'seed', 'exemple'
from public.cities c where c.name = 'Lisboa';

select test.ok((select count(*) from public.profiles) = 3, 'un profil est créé pour chaque inscription');
select test.ok((select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Alice', 'nom affiché repris des métadonnées (full_name)');
select test.ok((select display_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'Bob', 'nom affiché repris des métadonnées (name)');
select test.ok((select display_name from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003') = 'carol', 'nom affiché repris de l''email en dernier recours');

-- ===========================================================================
-- Données de référence
-- ===========================================================================
select test.as_anon();
select test.ok((select count(*) from public.countries) = 3, 'anonyme : lecture des pays');
select test.ok((select count(*) from public.places where id = 9001) = 1, 'anonyme : lecture d''un lieu actif');
select test.ok((select count(*) from public.places where id = 9002) = 0, 'anonyme : un lieu masqué est invisible');
select test.throws($$insert into public.countries (code, name_fr, name_en, source, license) values ('XX','x','x','x','x')$$, '42501', 'anonyme : écriture d''un pays');
select test.throws($$select * from public.trips$$, '42501', 'anonyme : aucun accès aux voyages');

select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.throws($$insert into public.places (city_id, kind, category_code, name, lat, lng, source, license) values (1,'activity','musee','x',0,0,'x','x')$$, '42501', 'utilisateur : écriture d''un lieu');
select test.throws($$select * from public.ingestion_queue$$, '42501', 'utilisateur : file de collecte inaccessible');
select test.throws($$select * from public.ingestion_runs$$, '42501', 'utilisateur : journal de collecte inaccessible');
select test.throws($$insert into public.places (city_id, kind, category_code, name, lat, lng, source, license)
                     select id, 'activity', 'pharmacie', 'x', 0, 0, 'x', 'x' from public.cities limit 1$$, '42501', 'utilisateur : écriture refusée avant même le contrôle de catégorie');

select test.as_admin();
select test.throws($$insert into public.places (city_id, kind, category_code, name, lat, lng, source, license)
                     select id, 'activity', 'pharmacie', 'x', 0, 0, 'x', 'x' from public.cities limit 1$$, '23503', 'une catégorie de service ne peut pas servir à une activité');

-- Villes phares : le script s'exécute sans erreur et relancé, n'ajoute rien
select test.as_admin();
\ir ../seed-villes-phares.sql
select count(*) as n_cities from public.cities \gset
\ir ../seed-villes-phares.sql
select test.ok((select count(*) from public.cities) = :n_cities, 'villes phares : relancer le script n''ajoute rien');

-- ===========================================================================
-- Voyage d'Alice
-- ===========================================================================
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');

insert into public.trips (id, title, starts_on, ends_on) values
  ('11111111-1111-1111-1111-111111111111', 'Lisbonne entre amis', '2026-10-13', '2026-10-16');
select test.ok((select count(*) from public.trips) = 1, 'le créateur relit son voyage juste après l''insertion');
select test.ok((select count(*) from public.trip_members where trip_id = '11111111-1111-1111-1111-111111111111') = 1, 'le créateur devient membre automatiquement');
select test.ok((select created_by from public.trips) = 'aaaaaaaa-0000-0000-0000-000000000001', 'created_by = utilisateur connecté');
do $$
declare v_by uuid;
begin
  begin
    insert into public.trips (title, created_by) values ('faux', 'bbbbbbbb-0000-0000-0000-000000000002') returning created_by into v_by;
    perform test.ok(v_by = 'aaaaaaaa-0000-0000-0000-000000000001', 'impossible de créer un voyage au nom d''un autre (created_by forcé)');
    raise exception using errcode = 'ZZ001';   -- annule ce voyage d'essai
  exception when sqlstate 'ZZ001' then null;
  end;
end $$;

insert into public.trip_stays (id, trip_id, name, address) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Hôtel do Chiado', 'Rua Garrett');
insert into public.trip_days (id, trip_id, day_date, stay_id, depart_time) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '2026-10-13', '22222222-2222-2222-2222-222222222222', '09:00');
insert into public.trip_items (id, trip_id, day_id, place_id, start_time, duration_min, position) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 9001, '10:00', 90, 1);
insert into public.trip_items (id, trip_id, day_id, title, position) values
  ('44444444-4444-4444-4444-444444444445', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Balade libre', 2);
insert into public.expenses (id, trip_id, label, poste, amount, paid_by, stay_id) values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Hôtel do Chiado, 3 nuits', 'hebergement', 390, 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
insert into public.trip_budget_lines (trip_id, poste, amount) values ('11111111-1111-1111-1111-111111111111', 'repas', 450);
insert into public.saved_places (trip_id, place_id, list) values ('11111111-1111-1111-1111-111111111111', 9001, 'favorite');
insert into public.trip_destinations (trip_id, city_id, position) select '11111111-1111-1111-1111-111111111111', id, 1 from public.cities order by id limit 1;
select test.ok((select count(*) from public.trip_destinations) = 1, 'une destination ajoutée au voyage');
select test.throws($$update public.trips set travelers = 0 where id = '11111111-1111-1111-1111-111111111111'$$, '23514', 'nombre de voyageurs invalide refusé');
select test.throws($$update public.trip_destinations set nights = -1$$, '23514', 'nuits négatives refusées');
select test.throws($$insert into public.trip_destinations (trip_id, city_id) select '11111111-1111-1111-1111-111111111111', id from public.cities order by id limit 1$$, '23505', 'la même ville ne s''ajoute pas deux fois');

select test.throws($$insert into public.trip_items (trip_id, day_id) values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333')$$, '23514', 'une étape sans lieu ni titre est refusée');
select test.throws($$insert into public.trip_days (trip_id, day_date) values ('11111111-1111-1111-1111-111111111111', '2026-10-13')$$, '23505', 'un seul enregistrement par jour et par voyage');
select test.throws($$insert into public.expenses (trip_id, label, poste, amount) values ('11111111-1111-1111-1111-111111111111', 'x', 'inconnu', 1)$$, '23514', 'poste de dépense inconnu refusé');
select test.throws($$insert into public.trips (title, starts_on, ends_on) values ('dates inversées', '2026-10-16', '2026-10-13')$$, '23514', 'dates de voyage incohérentes refusées');

-- ===========================================================================
-- Carol et Bob, non membres : rien de visible, rien de modifiable
-- ===========================================================================
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok((select count(*) from public.trips) = 0, 'non-membre : voyage invisible');
select test.ok((select count(*) from public.trip_items) = 0, 'non-membre : étapes invisibles');
select test.ok((select count(*) from public.expenses) = 0, 'non-membre : dépenses invisibles');
select test.ok((select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'non-membre : profil d''un inconnu invisible');
select test.ok((select count(*) from public.profiles) = 1, 'chacun voit son propre profil');
select test.throws($$insert into public.trip_items (trip_id, day_id, title) values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'intrus')$$, '42501', 'non-membre : ajout d''étape refusé');
select test.ok((select count(*) from public.trip_destinations) = 0, 'non-membre : destinations invisibles');
select test.throws($$insert into public.trip_destinations (trip_id, city_id) select '11111111-1111-1111-1111-111111111111', id from public.cities order by id limit 1$$, '42501', 'non-membre : ajout de destination refusé');
select test.throws($$insert into public.trip_members (trip_id, user_id) values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002')$$, '42501', 'impossible de s''ajouter soi-même à un voyage');
select test.throws($$select public.join_trip('XXXXXXXXXXXX')$$, 'P0002', 'code d''invitation inconnu refusé');
select test.ok((select count(*) from public.preview_invite('XXXXXXXXXXXX')) = 0, 'aperçu d''un code inconnu : rien');

update public.trips set title = 'piraté' where id = '11111111-1111-1111-1111-111111111111';
select test.as_admin();
select test.ok((select title from public.trips where id = '11111111-1111-1111-1111-111111111111') = 'Lisbonne entre amis', 'non-membre : modification sans effet');

-- ===========================================================================
-- Invitation, puis Bob rejoint : les deux sont à égalité
-- ===========================================================================
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.trip_invites (trip_id) values ('11111111-1111-1111-1111-111111111111');
select test.ok((select length(code) from public.trip_invites) = 12, 'code d''invitation de 12 caractères');
select set_config('test.code', (select code from public.trip_invites), true);

select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.ok((select count(*) from public.trip_invites) = 0, 'non-membre : invitations invisibles');

select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok((select member_count from public.preview_invite(current_setting('test.code'))) = 1, 'aperçu d''invitation : titre et nombre de membres');
select test.ok(public.join_trip(current_setting('test.code')) = '11111111-1111-1111-1111-111111111111', 'join_trip renvoie le voyage');
select test.ok((select count(*) from public.trips) = 1, 'nouveau membre : voyage visible');
select test.ok((select count(*) from public.trip_items) = 2, 'nouveau membre : étapes visibles');
select test.ok((select count(*) from public.trip_destinations) = 1, 'nouveau membre : destinations visibles');
select test.ok((select count(*) from public.profiles) = 2, 'membres : profils mutuellement visibles');
select test.ok(public.join_trip(current_setting('test.code')) is not null, 'rejoindre deux fois est sans effet');
select test.ok((select count(*) from public.trip_members where left_at is null) = 2, 'toujours deux membres actifs');

-- Bob modifie l'étape d'Alice : aucun rôle, aucune permission à demander
update public.trip_items set note = 'Réservé', start_time = '10:30' where id = '44444444-4444-4444-4444-444444444444';
select test.ok((select version from public.trip_items where id = '44444444-4444-4444-4444-444444444444') = 2, 'la version passe de 1 à 2');
select test.ok((select updated_by from public.trip_items where id = '44444444-4444-4444-4444-444444444444') = 'bbbbbbbb-0000-0000-0000-000000000002', 'dernier auteur = Bob');
select test.ok((select created_by from public.trip_items where id = '44444444-4444-4444-4444-444444444444') = 'aaaaaaaa-0000-0000-0000-000000000001', 'auteur d''origine conservé');

insert into public.expenses (trip_id, label, poste, amount, paid_by) values
  ('11111111-1111-1111-1111-111111111111', 'Train Lisbonne → Porto', 'transports', 75, 'bbbbbbbb-0000-0000-0000-000000000002');
select test.throws($$insert into public.expenses (trip_id, label, poste, amount, paid_by) values ('11111111-1111-1111-1111-111111111111', 'x', 'repas', 1, 'cccccccc-0000-0000-0000-000000000003')$$, '23514', 'le payeur doit être membre du voyage');

-- Bob ne peut pas réécrire l'auteur d'origine d'une ligne
update public.trip_items set created_by = 'bbbbbbbb-0000-0000-0000-000000000002' where id = '44444444-4444-4444-4444-444444444445';
select test.ok((select created_by from public.trip_items where id = '44444444-4444-4444-4444-444444444445') = 'aaaaaaaa-0000-0000-0000-000000000001', 'created_by ne peut pas être réécrit');
update public.trip_items set created_by = null where id = '44444444-4444-4444-4444-444444444445';
select test.ok((select created_by from public.trip_items where id = '44444444-4444-4444-4444-444444444445') = 'aaaaaaaa-0000-0000-0000-000000000001', 'created_by ne peut pas être effacé (son auteur existe)');

-- ===========================================================================
-- Intégrité entre voyages : un membre de deux voyages ne peut pas les mélanger
-- ===========================================================================
insert into public.trips (id, title) values ('66666666-6666-6666-6666-666666666666', 'Week-end de Bob');
select test.throws($$update public.trip_items set trip_id = '66666666-6666-6666-6666-666666666666' where id = '44444444-4444-4444-4444-444444444444'$$, '23514', 'déplacer une étape vers un autre voyage est refusé');
select test.throws($$insert into public.expenses (trip_id, label, poste, amount, item_id) values ('66666666-6666-6666-6666-666666666666', 'x', 'repas', 1, '44444444-4444-4444-4444-444444444444')$$, '23503', 'une dépense ne peut pas viser une étape d''un autre voyage');
select test.throws($$insert into public.trip_days (trip_id, day_date, stay_id) values ('66666666-6666-6666-6666-666666666666', '2026-11-01', '22222222-2222-2222-2222-222222222222')$$, '23503', 'un jour ne peut pas viser l''hébergement d''un autre voyage');
select test.throws($$delete from public.trips where id = '11111111-1111-1111-1111-111111111111'$$, '42501', 'aucune suppression définitive d''un voyage depuis l''app');

-- Corbeille : tout membre peut mettre un voyage à la corbeille (réversible)
update public.trips set deleted_at = now() where id = '66666666-6666-6666-6666-666666666666';
select test.ok((select deleted_at is not null from public.trips where id = '66666666-6666-6666-6666-666666666666'), 'mise à la corbeille d''un voyage');

-- ===========================================================================
-- Journal des modifications
-- ===========================================================================
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.ok((select count(*) from public.trip_activity_log where trip_id = '11111111-1111-1111-1111-111111111111') >= 10, 'le journal enregistre les modifications du voyage');
select test.ok(exists (
  select 1 from public.trip_activity_log
  where table_name = 'trip_items' and action = 'update'
    and actor = 'bbbbbbbb-0000-0000-0000-000000000002'
    and old_data ->> 'note' is null and new_data ->> 'note' = 'Réservé'
), 'le journal garde l''ancienne et la nouvelle valeur, avec l''auteur (annulation possible)');
select test.throws($$insert into public.trip_activity_log (trip_id, table_name, action) values ('11111111-1111-1111-1111-111111111111', 'trips', 'update')$$, '42501', 'le journal ne s''écrit pas depuis l''app');
select test.throws($$delete from public.trip_activity_log$$, '42501', 'le journal ne s''efface pas depuis l''app');

select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.ok((select count(*) from public.trip_activity_log) = 0, 'non-membre : journal invisible');

-- ===========================================================================
-- Bob quitte, puis revient avec le même lien
-- ===========================================================================
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.leave_trip('11111111-1111-1111-1111-111111111111');
select test.ok((select count(*) from public.trip_items) = 0, 'ancien membre : plus d''accès aux étapes');
select test.throws($$insert into public.trip_items (trip_id, day_id, title) values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'x')$$, '42501', 'ancien membre : ajout refusé');

select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select test.ok((select paid_by from public.expenses where label = 'Train Lisbonne → Porto') = 'bbbbbbbb-0000-0000-0000-000000000002', 'la dépense d''un ancien membre reste à son nom');
select test.ok((select count(*) from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 1, 'son nom reste affichable pour les soldes');

select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.join_trip(current_setting('test.code'));
select test.ok((select count(*) from public.trip_items) = 2, 'retour avec le même code : accès rétabli');

-- Invitation révoquée ou expirée
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update public.trip_invites set revoked_at = now();
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.throws($$select public.join_trip(current_setting('test.code'))$$, 'P0002', 'invitation révoquée refusée');
select test.as_admin();
update public.trip_invites set revoked_at = null, expires_at = now() - interval '1 minute';
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.throws($$select public.join_trip(current_setting('test.code'))$$, 'P0002', 'invitation expirée refusée');
select test.as_anon();
select test.throws($$select public.join_trip('X')$$, '42501', 'anonyme : join_trip inaccessible');
select test.throws($$select * from public.preview_invite('X')$$, '42501', 'anonyme : preview_invite inaccessible');

-- ===========================================================================
-- Collecte à la demande (file d'attente, flux unique)
-- ===========================================================================
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.ok(public.request_city_collection((select id from public.cities where name = 'Porto')) = 'queued', 'demande de collecte d''une ville vide : mise en file');
select test.ok(public.request_city_collection((select id from public.cities where name = 'Porto')) = 'queued', 'deuxième demande : pas de doublon');
select test.ok((select collection_status from public.cities where name = 'Porto') = 'queued', 'le statut de la ville passe à « queued »');
select test.throws($$select public.request_city_collection(-1)$$, 'P0002', 'ville inconnue refusée');
select test.throws($$select * from public.claim_collection_job()$$, '42501', 'utilisateur : ne peut pas prendre une tâche de collecte');

select test.as_admin();
select test.ok((select count(*) from public.ingestion_queue) = 1, 'une seule tâche en file pour Porto');

select test.as_service();
select test.ok((select count(*) from public.claim_collection_job('places')) = 1, 'pipeline : prend la tâche');
select test.ok((select count(*) from public.claim_collection_job('places')) = 0, 'pipeline : une tâche n''est jamais donnée deux fois');
select test.as_admin();
select test.ok((select status from public.ingestion_queue) = 'running' and (select attempts from public.ingestion_queue) = 1, 'la tâche est marquée « running », 1 tentative');

select test.as_anon();
select test.throws($$select public.request_city_collection(1)$$, '42501', 'anonyme : demande de collecte refusée');
select test.throws($$select * from public.trip_destinations$$, '42501', 'anonyme : destinations inaccessibles');

-- ===========================================================================
-- Collecte d'une ville depuis l'appli (migration 1600)
-- ===========================================================================
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.ok(public.begin_city_collection((select id from public.cities where name = 'Paris')) = 'go', 'appli : prend la main sur une ville vide');
select test.ok((select collection_status from public.cities where name = 'Paris') = 'collecting', 'la ville passe à « collecting »');
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok(public.begin_city_collection((select id from public.cities where name = 'Paris')) = 'busy', 'une autre personne ne collecte pas la même ville en même temps');
select test.throws($$select public.ingest_city_places((select id from public.cities where name = 'Paris'), '[]'::jsonb)$$, '42501', 'seule la personne qui a pris la main peut écrire');
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.throws($$select public.ingest_city_places((select id from public.cities where name = 'Paris'), '{"a":1}'::jsonb)$$, '22023', 'liste invalide refusée');
select public.ingest_city_places((select id from public.cities where name = 'Paris'), jsonb_build_array(
  jsonb_build_object('kind','activity','category_code','restaurant','name','Chez Test','lat',48.86,'lng',2.35,'popularity',2,'osm_type','node','osm_id',910001,'closed_days','[1]'::jsonb,'visit_duration_min',75,'tags','{}'::jsonb),
  jsonb_build_object('kind','activity','category_code','restaurant','name','Chez Test (doublon)','lat',48.86,'lng',2.35,'popularity',3,'osm_type','node','osm_id',910001),
  jsonb_build_object('kind','activity','category_code','restaurant','name','Trop loin','lat',10.0,'lng',2.35,'osm_type','node','osm_id',910002),
  jsonb_build_object('kind','activity','category_code','pharmacie','name','Mauvaise catégorie','lat',48.86,'lng',2.35,'osm_type','node','osm_id',910003),
  jsonb_build_object('kind','service','category_code','pharmacie','name','Pharmacie du coin','lat',48.857,'lng',2.34,'osm_type','way','osm_id',910004)
));
select test.as_admin();
select test.ok((select count(*) from public.places where osm_id in (910001, 910002, 910003, 910004)) = 2, 'seuls les lieux valides (proches, catégorie cohérente, sans doublon) sont écrits');
select test.ok((select source from public.places where osm_id = 910001) = 'openstreetmap', 'la source est forcée à openstreetmap');
select test.ok((select count(*) from public.place_sources where external_id in ('node/910001', 'way/910004')) = 2, 'la provenance est enregistrée');
select test.ok((select collection_status from public.cities where name = 'Paris') = 'ready', 'la ville est prête après l''écriture');
select test.ok((select status from public.ingestion_queue where city_id = (select id from public.cities where name = 'Paris')) = 'done', 'la tâche est terminée');
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.ok(public.begin_city_collection((select id from public.cities where name = 'Paris')) = 'ready', 'ville déjà prête : rien à refaire');
-- Élargir la zone d'une ville prête (migration 1800)
select test.ok(public.extend_city_collection((select id from public.cities where name = 'Paris')) = 'go', 'élargir : prend la main sur une ville prête');
select test.ok((select collection_status from public.cities where name = 'Paris') = 'collecting', 'élargir : la ville repasse à « collecting »');
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok(public.extend_city_collection((select id from public.cities where name = 'Paris')) = 'busy', 'élargir : une seule personne à la fois');
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select public.ingest_city_places((select id from public.cities where name = 'Paris'), '[]'::jsonb);
select test.ok((select collection_status from public.cities where name = 'Paris') = 'ready', 'élargir : la ville est de nouveau prête après l''écriture');
select test.ok(public.extend_city_collection((select id from public.cities where name_fr = 'Tokyo')) = 'busy', 'élargir : une ville pas prête n''est pas élargie');
-- Mode du voyage (migration 1900)
select test.as_admin();
select test.ok((select mode from public.trips limit 1) = 'complet', 'mode : « complet » par défaut');
select test.throws($$update public.trips set mode = 'autre'$$, '23514', 'mode : valeur inconnue refusée');
select test.as_user('cccccccc-0000-0000-0000-000000000003');
-- Rendre la main au robot
select test.ok(public.begin_city_collection((select id from public.cities where name_fr = 'Tokyo')) = 'go', 'Tokyo : prise en main');
select public.release_city_collection((select id from public.cities where name_fr = 'Tokyo'), 'Overpass injoignable');
select test.as_admin();
select test.ok((select collection_status from public.cities where name_fr = 'Tokyo') = 'queued', 'rendre la main : la ville repasse « en file » pour le robot');
select test.as_anon();
select test.throws($$select public.begin_city_collection(1)$$, '42501', 'anonyme : begin_city_collection refusé');
select test.throws($$select public.ingest_city_places(1, '[]'::jsonb)$$, '42501', 'anonyme : ingest_city_places refusé');

-- Reprise des collectes abandonnées (migration 1700)
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.ok(public.begin_city_collection((select id from public.cities where name_fr = 'Tokyo')) = 'go', 'Tokyo : prise en main avant abandon');
select test.as_admin();
select test.ok((select count(*) from public.claim_collection_job('places')) = 0, 'une collecte toute récente n''est pas reprise');
update public.cities set collection_status = 'collecting' where name_fr = 'Tokyo';
update public.ingestion_queue set status = 'running', started_at = now() - interval '20 minutes' where city_id = (select id from public.cities where name_fr = 'Tokyo');
select test.as_service();
select test.ok((select count(*) from public.claim_collection_job('places')) = 1, 'le robot reprend une collecte abandonnée depuis plus de 10 minutes');
select test.as_admin();
select test.ok((select status from public.ingestion_queue where city_id = (select id from public.cities where name_fr = 'Tokyo')) = 'running', 'la tâche reprise est de nouveau « running »');

-- ===========================================================================
-- Lien de partage en lecture seule
-- ===========================================================================
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
do $$ declare t text; begin
  insert into public.trip_shares (trip_id) values ('11111111-1111-1111-1111-111111111111') returning token into t;
  perform set_config('test.share', t, false);
end $$;
select test.as_user('eeeeeeee-0000-0000-0000-00000000000e');
select test.throws($$insert into public.trip_shares (trip_id) values ('11111111-1111-1111-1111-111111111111')$$, '42501', 'un non-membre ne peut pas créer de lien de partage');
select test.as_anon();
select test.ok(public.shared_trip(current_setting('test.share')) is not null, 'anonyme : le lien de partage montre le programme');
select test.ok(not (public.shared_trip(current_setting('test.share')) ? 'expenses') and not (public.shared_trip(current_setting('test.share')) ? 'members'), 'le lien de partage n''expose ni dépenses ni membres');
select test.ok(jsonb_typeof(public.shared_trip(current_setting('test.share'))->'stops') = 'array', 'le lien de partage donne les villes du trajet (stops)');
select test.ok(public.shared_trip('inconnu') is null, 'un jeton inconnu ne donne rien');
select test.throws($$select * from public.trip_shares$$, '42501', 'anonyme : table des liens inaccessible');
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update public.trip_shares set revoked_at = now() where token = current_setting('test.share');
select test.as_anon();
select test.ok(public.shared_trip(current_setting('test.share')) is null, 'un lien révoqué ne donne plus rien');

-- ===========================================================================
-- Corbeille visible dans l'aperçu ; suppression définitive côté serveur
-- ===========================================================================
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update public.trips set deleted_at = now() where id = '11111111-1111-1111-1111-111111111111';
update public.trip_invites set expires_at = now() + interval '1 day' , revoked_at = null;
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select test.ok((select count(*) from public.preview_invite(current_setting('test.code'))) = 0, 'un voyage à la corbeille ne peut plus être rejoint');

select test.as_service();
delete from public.trips where id = '11111111-1111-1111-1111-111111111111';
select test.as_admin();
select test.ok((select count(*) from public.trip_items where trip_id = '11111111-1111-1111-1111-111111111111') = 0, 'suppression serveur : tout le voyage disparaît en cascade');
select test.ok((select count(*) from public.trip_destinations) = 0, 'suppression serveur : les destinations aussi');
select test.ok((select count(*) from public.trip_activity_log where trip_id = '11111111-1111-1111-1111-111111111111') = 0, 'suppression serveur : le journal du voyage aussi');

-- ===========================================================================
-- Remontée des erreurs de l'appli (migration 2000)
-- ===========================================================================
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.log_client_error('Erreur d''essai', 'pile', '/trip/x', 'android', 'abc1234', true);
select public.log_client_error('   ');
select public.log_client_error(repeat('x', 800));
select test.throws($$select * from public.client_errors$$, '42501', 'erreurs : la table n''est pas lisible depuis l''appli');
select test.throws($$insert into public.client_errors (user_id, message) values ('bbbbbbbb-0000-0000-0000-000000000002', 'x')$$, '42501', 'erreurs : pas d''écriture directe dans la table');
do $$ begin for i in 1..40 loop perform public.log_client_error('rafale ' || i); end loop; end $$;
select test.as_anon();
select test.throws($$select public.log_client_error('anonyme')$$, '42501', 'anonyme : envoi d''erreur refusé');
select test.as_admin();
select test.ok((select fatal and screen = '/trip/x' and platform = 'android' and build = 'abc1234' from public.client_errors where message = 'Erreur d''essai'), 'erreurs : écran, plateforme, build et plantage enregistrés');
select test.ok((select max(length(message)) from public.client_errors) = 500, 'erreurs : message tronqué à 500 caractères');
select test.ok((select count(*) from public.client_errors where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 30, 'erreurs : 30 rapports par personne et par 24 h au plus, message vide ignoré');
insert into public.client_errors (user_id, message, created_at) values ('cccccccc-0000-0000-0000-000000000003', 'ancienne', now() - interval '31 days');
select test.as_user('cccccccc-0000-0000-0000-000000000003');
select public.log_client_error('récente');
select test.as_admin();
select test.ok(not exists (select 1 from public.client_errors where message = 'ancienne') and exists (select 1 from public.client_errors where message = 'récente'), 'erreurs : effacées après 30 jours');
insert into auth.users (id, email, raw_user_meta_data) values ('dddddddd-0000-0000-0000-000000000004', 'dan@example.test', '{}');
select test.as_user('dddddddd-0000-0000-0000-000000000004');
select public.log_client_error('erreur de Dan');
select test.as_admin();
delete from auth.users where id = 'dddddddd-0000-0000-0000-000000000004';
select test.ok(not exists (select 1 from public.client_errors where message = 'erreur de Dan'), 'erreurs : effacées avec le compte');

-- ===========================================================================
-- Supprimer son compte en étant dans un voyage partagé (migration 2100)
-- ===========================================================================
select test.as_admin();
insert into auth.users (id, email, raw_user_meta_data) values ('ffffffff-0000-0000-0000-00000000000f', 'fanny@example.test', '{}');
select test.as_user('ffffffff-0000-0000-0000-00000000000f');
insert into public.trips (id, title) values ('f6000000-0000-0000-0000-000000000001', 'Voyage de Fanny');
insert into public.trip_days (id, trip_id, day_date) values ('f7000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001', '2026-11-02');
insert into public.trip_items (id, trip_id, day_id, title, position) values ('f8000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001', 'Marché', 1);
insert into public.expenses (id, trip_id, label, poste, amount, paid_by) values ('f9000000-0000-0000-0000-000000000001', 'f6000000-0000-0000-0000-000000000001', 'Dîner', 'repas', 60, 'ffffffff-0000-0000-0000-00000000000f');
insert into public.saved_places (trip_id, place_id, list) values ('f6000000-0000-0000-0000-000000000001', 9001, 'favorite');
update public.trips set title = 'Voyage de Fanny et Carol' where id = 'f6000000-0000-0000-0000-000000000001';
select test.as_admin();
insert into public.trip_members (trip_id, user_id) values ('f6000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003');
select test.as_user('ffffffff-0000-0000-0000-00000000000f');
select public.delete_my_account();
select test.as_admin();
select test.ok(not exists (select 1 from public.profiles where id = 'ffffffff-0000-0000-0000-00000000000f'), 'suppression du compte dans un voyage partagé : le profil est effacé');
select test.ok((select created_by is null and updated_by is null from public.trips where id = 'f6000000-0000-0000-0000-000000000001'), 'le voyage partagé reste, auteur inconnu');
select test.ok((select created_by is null and paid_by is null from public.expenses where id = 'f9000000-0000-0000-0000-000000000001'), 'sa dépense reste, sans nom');
select test.ok((select created_by is null from public.trip_items where id = 'f8000000-0000-0000-0000-000000000001'), 'son étape reste, auteur inconnu');
select test.ok(not exists (select 1 from public.trip_members where trip_id = 'f6000000-0000-0000-0000-000000000001' and user_id = 'ffffffff-0000-0000-0000-00000000000f')
  and exists (select 1 from public.trip_members where trip_id = 'f6000000-0000-0000-0000-000000000001' and user_id = 'cccccccc-0000-0000-0000-000000000003'), 'elle quitte le voyage, Carol y reste');
select test.ok(not exists (select 1 from public.trip_activity_log where actor = 'ffffffff-0000-0000-0000-00000000000f'), 'le journal ne garde pas son identifiant');
select test.as_user('cccccccc-0000-0000-0000-000000000003');
update public.trips set title = 'Voyage de Carol' where id = 'f6000000-0000-0000-0000-000000000001';
select test.as_admin();
select test.ok((select created_by is null and updated_by = 'cccccccc-0000-0000-0000-000000000003' from public.trips where id = 'f6000000-0000-0000-0000-000000000001'), 'Carol peut encore modifier le voyage (auteur toujours inconnu)');
-- ===========================================================================
-- Ajouter un lieu qui manque (migration 2500)
-- ===========================================================================
select test.as_admin();
select set_config('test.lisboa', (select id::text from public.cities where name = 'Lisboa'), true);
select test.as_anon();
select test.throws($$select public.add_user_place(1, 'x', 38.7, -9.1, 'cafe', 'osm')$$, '42501', 'anonyme : ajout de lieu refusé');
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select set_config('test.p1', public.add_user_place(current_setting('test.lisboa')::bigint, '  Pastéis de Belém ', 38.6975, -9.2033, 'cafe', 'osm', 'node', 398922337, 'Rua de Belém 84')::text, true);
select test.ok((select name = 'Pastéis de Belém' and kind = 'activity' and source = 'photon' and license = 'ODbL 1.0'
  and added_by = 'aaaaaaaa-0000-0000-0000-000000000001' from public.places where id = current_setting('test.p1')::bigint), 'ajout d''un lieu OpenStreetMap : nom nettoyé, licence, auteur');
select test.ok(public.add_user_place(current_setting('test.lisboa')::bigint, 'Autre nom', 38.6975, -9.2033, 'cafe', 'osm', 'node', 398922337) = current_setting('test.p1')::bigint, 'même référence OpenStreetMap : lieu réutilisé');
select test.ok(public.add_user_place(current_setting('test.lisboa')::bigint, 'pastéis de belém', 38.6976, -9.2034, 'cafe', 'google_maps') = current_setting('test.p1')::bigint, 'même nom au même endroit : lieu réutilisé');
select set_config('test.p2', public.add_user_place(current_setting('test.lisboa')::bigint, 'Miradouro de Santa Luzia', 38.7116, -9.1301, 'point_de_vue', 'google_maps')::text, true);
select test.ok((select source = 'google_maps_link' and license = 'saisie voyageur' and osm_id is null from public.places
  where id = current_setting('test.p2')::bigint), 'ajout depuis un lien Google Maps');
select test.throws($$select public.add_user_place(current_setting('test.lisboa')::bigint, 'Porto', 41.15, -8.61, 'cafe', 'osm')$$, '22023', 'lieu à plus de 60 km de la ville refusé');
select test.throws($$select public.add_user_place(current_setting('test.lisboa')::bigint, 'x', 38.7, -9.1, 'hebergement', 'osm')$$, '22023', 'type de lieu hors activités et services refusé');
select test.throws($$select public.add_user_place(current_setting('test.lisboa')::bigint, '   ', 38.7, -9.1, 'cafe', 'osm')$$, '22023', 'nom vide refusé');
select test.throws($$select public.add_user_place(current_setting('test.lisboa')::bigint, 'x', 38.7, -9.1, 'cafe', 'google_maps', 'node', 1)$$, '22023', 'référence OpenStreetMap sur un lien Google refusée');
select test.throws($$select public.add_user_place(current_setting('test.lisboa')::bigint, 'Pharmacie masquée', 38.73, -9.15, 'pharmacie', 'osm')$$, '22023', 'un lieu masqué ne revient pas');
select test.throws($$insert into public.places (city_id, kind, category_code, name, lat, lng, source, license) values (1,'activity','cafe','x',0,0,'x','x')$$, '42501', 'toujours pas d''écriture directe dans les lieux');
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  for i in 1..40 loop
    perform public.add_user_place(current_setting('test.lisboa')::bigint, 'Lieu ' || i, 38.70 + i * 0.0005, -9.14, 'cafe', 'google_maps');
  end loop;
end $$;
select test.throws($$select public.add_user_place(current_setting('test.lisboa')::bigint, 'Lieu 41', 38.69, -9.14, 'cafe', 'google_maps')$$, '53400', 'au plus 40 lieux ajoutés par jour et par personne');
select test.as_admin();

-- ===========================================================================
-- Carnet de voyage : note et photos du jour, stockage privé (migration 2600)
-- ===========================================================================
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.trips (id, title) values ('c6000000-0000-0000-0000-000000000001', 'Carnet d''Alice');
insert into public.trip_days (id, trip_id, day_date) values ('c7000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', '2026-12-01');
insert into public.trip_journal (day_id, trip_id, note) values ('c7000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 'Coucher de soleil');
select test.ok((select updated_by = 'aaaaaaaa-0000-0000-0000-000000000001' from public.trip_journal where day_id = 'c7000000-0000-0000-0000-000000000001'), 'carnet : note du jour écrite, autrice notée');
insert into public.trip_photos (trip_id, day_id, path, created_by) values ('c6000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001',
  'c6000000-0000-0000-0000-000000000001/c7000000-0000-0000-0000-000000000001/p1.jpg', 'bbbbbbbb-0000-0000-0000-000000000002');
select test.ok((select created_by = 'aaaaaaaa-0000-0000-0000-000000000001' from public.trip_photos where path like '%/p1.jpg'), 'carnet : l''auteur d''une photo ne s''usurpe pas');
select test.throws($$insert into public.trip_photos (trip_id, day_id, path) values ('c6000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'autre/chemin.jpg')$$, '23514', 'carnet : le chemin d''une photo suit voyage/jour');
insert into storage.objects (bucket_id, name) values ('trip-photos', 'c6000000-0000-0000-0000-000000000001/c7000000-0000-0000-0000-000000000001/p1.jpg');
select test.ok((select count(*) from storage.objects where bucket_id = 'trip-photos') = 1, 'stockage : une membre envoie et voit sa photo');
select test.throws($$insert into storage.objects (bucket_id, name) values ('trip-photos', 'pas-un-voyage/x.jpg')$$, '42501', 'stockage : chemin hors voyage refusé');
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.ok((select count(*) from public.trip_journal where trip_id = 'c6000000-0000-0000-0000-000000000001') = 0, 'carnet : invisible hors du voyage');
select test.ok((select count(*) from public.trip_photos where trip_id = 'c6000000-0000-0000-0000-000000000001') = 0, 'carnet : photos invisibles hors du voyage');
select test.ok((select count(*) from storage.objects where bucket_id = 'trip-photos') = 0, 'stockage : fichiers invisibles hors du voyage');
select test.throws($$insert into storage.objects (bucket_id, name) values ('trip-photos', 'c6000000-0000-0000-0000-000000000001/c7000000-0000-0000-0000-000000000001/intrus.jpg')$$, '42501', 'stockage : envoi refusé hors du voyage');
select test.throws($$insert into public.trip_journal (day_id, trip_id, note) values ('c7000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 'x')$$, '42501', 'carnet : écriture refusée hors du voyage');
select test.as_admin();
insert into public.trip_members (trip_id, user_id) values ('c6000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
update public.trip_journal set note = 'Coucher de soleil, puis fado' where day_id = 'c7000000-0000-0000-0000-000000000001';
select test.ok((select updated_by = 'bbbbbbbb-0000-0000-0000-000000000002' and created_by = 'aaaaaaaa-0000-0000-0000-000000000001' from public.trip_journal where day_id = 'c7000000-0000-0000-0000-000000000001'), 'carnet : un autre membre complète la note');
delete from public.trip_photos where path like '%/p1.jpg';
delete from storage.objects where name like '%/p1.jpg';
select test.ok((select count(*) from public.trip_photos where path like '%/p1.jpg') = 1, 'carnet : on ne supprime pas la photo d''un autre');
select test.as_admin();
select test.ok((select count(*) from storage.objects where name like '%/p1.jpg') = 1, 'stockage : le fichier d''un autre reste');
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  for i in 2..12 loop
    insert into public.trip_photos (trip_id, day_id, path) values ('c6000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001',
      'c6000000-0000-0000-0000-000000000001/c7000000-0000-0000-0000-000000000001/p' || i || '.jpg');
  end loop;
end $$;
select test.throws($$insert into public.trip_photos (trip_id, day_id, path) values ('c6000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001/c7000000-0000-0000-0000-000000000001/p13.jpg')$$, '23514', 'carnet : au plus 12 photos par jour');
delete from public.trip_photos where path like '%/p1.jpg';
select test.ok((select count(*) from public.trip_photos where path like '%/p1.jpg') = 0, 'carnet : on supprime sa propre photo');
select test.as_admin();

-- ===========================================================================
-- Refaire un voyage : le sien, ou depuis un lien de partage (migration 2700)
-- ===========================================================================
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.trips (id, title, starts_on, ends_on, travelers, budget_total) values ('d6000000-0000-0000-0000-000000000001', 'Lisbonne en mai', '2026-05-12', '2026-05-13', 2, 900);
insert into public.trip_destinations (trip_id, city_id, position, nights) values ('d6000000-0000-0000-0000-000000000001', current_setting('test.lisboa')::bigint, 1, 1);
insert into public.trip_days (id, trip_id, day_date, city_id) values ('d7000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', '2026-05-12', current_setting('test.lisboa')::bigint), ('d7000000-0000-0000-0000-000000000002', 'd6000000-0000-0000-0000-000000000001', '2026-05-13', null);
insert into public.trip_items (trip_id, day_id, plan, place_id, title, start_time, position, note, done) values
  ('d6000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000001', 'A', 9001, null, '09:30', 1, 'Réserver', true),
  ('d6000000-0000-0000-0000-000000000001', 'd7000000-0000-0000-0000-000000000002', 'B', null, 'Pique-nique', null, 1, null, false);
insert into public.trip_budget_lines (trip_id, poste, amount) values ('d6000000-0000-0000-0000-000000000001', 'repas', 200);
insert into public.expenses (trip_id, label, poste, amount, paid_by) values ('d6000000-0000-0000-0000-000000000001', 'Dîner', 'repas', 40, 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.trip_journal (day_id, trip_id, note) values ('d7000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', 'Super journée');
select set_config('test.copy', public.copy_trip('d6000000-0000-0000-0000-000000000001', '  Lisbonne 2027 ', '2027-05-08', true, true)::text, true);
select test.ok((select title = 'Lisbonne 2027' and starts_on = '2027-05-08' and ends_on = '2027-05-09' and travelers = 2 and budget_total = 900
  from public.trips where id = current_setting('test.copy')::uuid), 'refaire : nouveau voyage, dates décalées, voyageurs et budget repris');
select test.ok((select count(*) from public.trip_members where trip_id = current_setting('test.copy')::uuid) = 1
  and exists (select 1 from public.trip_members where trip_id = current_setting('test.copy')::uuid and user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'refaire : seule la personne qui copie est voyageuse');
select test.ok((select string_agg(day_date::text, ',' order by day_date) from public.trip_days where trip_id = current_setting('test.copy')::uuid) = '2027-05-08,2027-05-09', 'refaire : jours décalés à la nouvelle date');
select test.ok((select count(*) from public.trip_items i join public.trip_days d on d.id = i.day_id and d.trip_id = i.trip_id
  where i.trip_id = current_setting('test.copy')::uuid) = 2, 'refaire : étapes des plans A et B rangées dans les nouveaux jours');
select test.ok((select bool_and(not done) from public.trip_items where trip_id = current_setting('test.copy')::uuid), 'refaire : étapes remises à « à faire »');
select test.ok((select nights from public.trip_destinations where trip_id = current_setting('test.copy')::uuid) = 1, 'refaire : villes et nuits reprises');
select test.ok((select amount from public.trip_budget_lines where trip_id = current_setting('test.copy')::uuid and poste = 'repas') = 200, 'refaire : enveloppes du budget reprises');
select test.ok(not exists (select 1 from public.expenses where trip_id = current_setting('test.copy')::uuid)
  and not exists (select 1 from public.trip_journal where trip_id = current_setting('test.copy')::uuid), 'refaire : ni dépenses ni carnet');
select set_config('test.copy2', public.copy_trip('d6000000-0000-0000-0000-000000000001', 'Sans programme', '2027-06-01', false, false)::text, true);
select test.ok(not exists (select 1 from public.trip_items where trip_id = current_setting('test.copy2')::uuid)
  and not exists (select 1 from public.trip_budget_lines where trip_id = current_setting('test.copy2')::uuid)
  and (select budget_total is null from public.trips where id = current_setting('test.copy2')::uuid), 'refaire : sans programme ni budget si on le choisit');
select test.throws($$select public.copy_trip('d6000000-0000-0000-0000-000000000001', 'x', null, true, true)$$, '22023', 'refaire : date de départ obligatoire pour un voyage daté');
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.throws($$select public.copy_trip('d6000000-0000-0000-0000-000000000001', 'Copie', '2027-01-01', true, true)$$, '42501', 'refaire : impossible pour un voyage dont on n''est pas voyageur');
select test.throws($$select public.copy_trip_rows('d6000000-0000-0000-0000-000000000001', 'x', '2027-01-01', array['A'], true, true)$$, '42501', 'refaire : la copie interne n''est pas appelable depuis l''appli');
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.trip_shares (token, trip_id) values ('partage-copie-test', 'd6000000-0000-0000-0000-000000000001');
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select set_config('test.copy3', public.copy_shared_trip('partage-copie-test', '2027-07-01')::text, true);
select test.ok((select created_by = 'bbbbbbbb-0000-0000-0000-000000000002' and starts_on = '2027-07-01' and budget_total is null and travelers = 1
  from public.trips where id = current_setting('test.copy3')::uuid), 'lien de partage : le voyage est à soi, sans budget ni voyageurs repris');
select test.ok((select count(*) from public.trip_items where trip_id = current_setting('test.copy3')::uuid and plan = 'A') = 1
  and (select count(*) from public.trip_items where trip_id = current_setting('test.copy3')::uuid) = 1, 'lien de partage : seulement le programme que la page montre (plan A)');
select test.ok(not exists (select 1 from public.trip_budget_lines where trip_id = current_setting('test.copy3')::uuid), 'lien de partage : budget jamais repris');
select test.as_admin();
select test.ok(not exists (select 1 from public.trip_members where trip_id = 'd6000000-0000-0000-0000-000000000001' and user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'lien de partage : on ne rejoint pas le voyage d''origine');
select test.as_user('aaaaaaaa-0000-0000-0000-000000000001');
update public.trip_shares set revoked_at = now() where token = 'partage-copie-test';
select test.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select test.throws($$select public.copy_shared_trip('partage-copie-test', '2027-07-01')$$, 'P0002', 'lien de partage retiré : plus de copie possible');
select test.as_anon();
select test.throws($$select public.copy_shared_trip('partage-copie-test', '2027-07-01')$$, '42501', 'anonyme : pas de copie');
select test.as_admin();

do $$ begin raise notice ''; raise notice 'TOUS LES TESTS PASSENT'; end $$;
rollback;
