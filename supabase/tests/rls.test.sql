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

do $$ begin raise notice ''; raise notice 'TOUS LES TESTS PASSENT'; end $$;
rollback;
