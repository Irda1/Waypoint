-- Waypoint · migration 2900 : notifications entre amis (téléphones, choix de chacun, file d'attente)
--
-- Quand un voyageur change un voyage (programme, dépenses, réservations, carnet, voyageurs), les autres membres
-- reçoivent une notification sur leur téléphone Android, même appli fermée. Des déclencheurs mettent chaque changement
-- dans `notif_queue` (lisible seulement par le serveur) ; la fonction Edge `notify-friends`, lancée chaque minute par une
-- tâche planifiée (Integrations > Cron), les regroupe par ami, voyage et type, puis les envoie par Firebase.
-- `push_devices` : les téléphones de chacun (inscription par `register_push_device`, un téléphone suit le dernier compte
-- connecté). `notification_prefs` : les choix faits dans Paramètres ; sans ligne, tout est activé.
-- L'appli marche sans cette migration : la partie « Activité des amis » des Paramètres le signale.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 2800.

-- ---------------------------------------------------------------- Téléphones
create table public.push_devices (
  token       text primary key check (char_length(token) between 10 and 4096),
  user_id     uuid not null references auth.users (id) on delete cascade,
  platform    text not null default 'android' check (platform in ('android', 'ios')),
  updated_at  timestamptz not null default now()
);
create index push_devices_user_idx on public.push_devices (user_id);
alter table public.push_devices enable row level security;
create policy "soi : lecture" on public.push_devices for select to authenticated using (user_id = auth.uid());
create policy "soi : suppression" on public.push_devices for delete to authenticated using (user_id = auth.uid());
revoke insert, update, truncate on public.push_devices from anon, authenticated;

create or replace function public.register_push_device(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  insert into public.push_devices (token, user_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;
revoke all on function public.register_push_device(text, text) from public, anon;
grant execute on function public.register_push_device(text, text) to authenticated;

-- ---------------------------------------------------------------- Choix de chacun
create table public.notification_prefs (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled       boolean not null default true,
  programme     boolean not null default true,
  depenses      boolean not null default true,
  reservations  boolean not null default true,
  carnet        boolean not null default true,
  voyageurs     boolean not null default true,
  updated_at    timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
create policy "soi : lecture" on public.notification_prefs for select to authenticated using (user_id = auth.uid());
create policy "soi : ajout" on public.notification_prefs for insert to authenticated with check (user_id = auth.uid());
create policy "soi : modification" on public.notification_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke truncate on public.notification_prefs from anon, authenticated;

-- ---------------------------------------------------------------- File d'attente (serveur seulement)
-- Sans clé étrangère : supprimer un voyage ou un compte ne doit jamais échouer à cause d'une notification en attente.
create table public.notif_queue (
  id          bigint generated always as identity primary key,
  trip_id     uuid not null,
  actor       uuid not null,
  kind        text not null check (kind in ('programme', 'depenses', 'reservations', 'carnet', 'voyageurs')),
  action      text not null,
  label       text not null default '',
  amount      numeric(12, 2),
  currency    char(3),
  created_at  timestamptz not null default now()
);
create index notif_queue_created_idx on public.notif_queue (created_at);
alter table public.notif_queue enable row level security;
revoke all on public.notif_queue from anon, authenticated;

-- Un seul déclencheur pour toutes les tables suivies ; les changements faits par le serveur (sans utilisateur) sont ignorés.
create or replace function public.tg_notif_enqueue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_kind text;
  v_action text;
  v_label text := '';
begin
  if auth.uid() is null then return null; end if;
  case tg_table_name
    when 'trip_items' then
      -- Cocher « fait » n'est pas un changement de programme.
      if tg_op = 'UPDATE' and (v_new->'start_time', v_new->'day_id', v_new->'position', v_new->'title', v_new->'place_id')
        is not distinct from (v_old->'start_time', v_old->'day_id', v_old->'position', v_old->'title', v_old->'place_id') then
        return null;
      end if;
      v_kind := 'programme';
      v_action := case tg_op when 'INSERT' then 'ajout' when 'DELETE' then 'retrait' else 'modif' end;
      v_label := coalesce(v_row->>'title', (select p.name from public.places p where p.id = (v_row->>'place_id')::bigint), '');
    when 'expenses' then
      v_kind := 'depenses'; v_action := 'paiement'; v_label := v_row->>'label';
    when 'settlement_payments' then
      v_kind := 'depenses'; v_action := 'remboursement';
    when 'trip_bookings' then
      v_kind := 'reservations'; v_action := 'ajout'; v_label := v_row->>'title';
    when 'trip_booking_files' then
      v_kind := 'reservations'; v_action := 'billet';
      v_label := coalesce((select b.title from public.trip_bookings b where b.id = (v_row->>'booking_id')::uuid), '');
    when 'trip_photos' then
      v_kind := 'carnet'; v_action := 'photo';
    when 'trip_journal' then
      if coalesce(v_new->>'note', '') = '' or v_new->'note' is not distinct from v_old->'note' then return null; end if;
      v_kind := 'carnet'; v_action := 'note';
    when 'trip_members' then
      v_kind := 'voyageurs';
      if tg_op = 'INSERT' then
        v_action := 'rejoint';
      elsif v_old->>'left_at' is null and v_new->>'left_at' is not null then
        v_action := 'quitte';
      else
        return null;
      end if;
  end case;
  insert into public.notif_queue (trip_id, actor, kind, action, label, amount, currency)
  values ((v_row->>'trip_id')::uuid, auth.uid(), v_kind, v_action, left(coalesce(v_label, ''), 120),
          (v_row->>'amount')::numeric, v_row->>'currency');
  return null;
end $$;
revoke all on function public.tg_notif_enqueue() from public, anon, authenticated;

create trigger notif_trip_items after insert or update or delete on public.trip_items for each row execute function public.tg_notif_enqueue();
create trigger notif_expenses after insert on public.expenses for each row execute function public.tg_notif_enqueue();
create trigger notif_settlement_payments after insert on public.settlement_payments for each row execute function public.tg_notif_enqueue();
create trigger notif_trip_bookings after insert on public.trip_bookings for each row execute function public.tg_notif_enqueue();
create trigger notif_trip_booking_files after insert on public.trip_booking_files for each row execute function public.tg_notif_enqueue();
create trigger notif_trip_photos after insert on public.trip_photos for each row execute function public.tg_notif_enqueue();
create trigger notif_trip_journal after insert or update on public.trip_journal for each row execute function public.tg_notif_enqueue();
create trigger notif_trip_members after insert or update on public.trip_members for each row execute function public.tg_notif_enqueue();
