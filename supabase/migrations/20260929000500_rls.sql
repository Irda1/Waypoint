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
