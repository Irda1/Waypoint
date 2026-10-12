-- Waypoint · migration 2700 : refaire un voyage (le sien, ou celui d'un lien de partage)
--
-- « Refaire ce voyage » crée un nouveau voyage à partir d'un autre, d'un seul coup (tout est créé, ou rien) :
--   * copy_trip(voyage, nom, départ, programme, budget) : un voyage dont on est voyageur. On reprend les villes et
--     les nuits, les jours décalés à la nouvelle date de départ, et au choix le programme (étapes des plans A, B et C,
--     avec horaires et notes) et le budget prévu (enveloppes par poste, budget global).
--   * copy_shared_trip(jeton, départ) : depuis la page de partage d'un ami (lien encore valide). On ne reprend que
--     ce que cette page montre déjà à tout le monde : villes, nuits et programme du plan A. Jamais le budget.
-- Jamais copiés : dépenses, remboursements, carnet et photos, hébergements, voyageurs, liens et invitations,
-- mémo du voyage, étapes cochées. La personne qui copie devient la seule voyageuse du nouveau voyage.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 2600.
-- Sans elle l'appli marche comme avant : « Refaire ce voyage » répond « pas encore disponible ».

-- Copie commune (interne : appelée seulement par les deux fonctions ci-dessous, jamais par l'appli).
create or replace function public.copy_trip_rows(
  p_src     uuid,
  p_title   text,
  p_start   date,
  p_plans   text[],     -- plans d'étapes à reprendre ('A', 'B', 'C') ; vide = pas de programme
  p_budget  boolean,    -- reprendre le budget prévu
  p_own     boolean     -- copie de son propre voyage (voyageurs et type de groupe repris)
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_src   public.trips;
  v_ref   date;
  v_shift integer := 0;
  v_new   uuid;
  v_map   jsonb;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  select * into v_src from public.trips t where t.id = p_src and t.deleted_at is null;
  if not found then
    raise exception 'Voyage introuvable.' using errcode = 'P0002';
  end if;
  if v_title = '' then v_title := v_src.title; end if;
  v_title := left(v_title, 120);

  -- Date de référence : le départ du voyage, sinon son premier jour. Un voyage daté demande une nouvelle date.
  v_ref := coalesce(v_src.starts_on, (select min(d.day_date) from public.trip_days d where d.trip_id = p_src));
  if v_ref is not null then
    if p_start is null then
      raise exception 'Choisis une date de départ.' using errcode = '22023';
    end if;
    v_shift := p_start - v_ref;
  end if;

  insert into public.trips (title, starts_on, ends_on, currency, country_code, travelers, party_type, styles, mode,
                            budget_total, budget_level)
  values (v_title, v_src.starts_on + v_shift, v_src.ends_on + v_shift, v_src.currency, v_src.country_code,
          case when p_own then v_src.travelers else 1 end,
          case when p_own then v_src.party_type end,
          v_src.styles, v_src.mode,
          case when p_budget then v_src.budget_total end,
          case when p_budget then v_src.budget_level end)
  returning id into v_new;   -- la personne qui copie en devient voyageuse (déclencheur trips_creator_member)

  insert into public.trip_destinations (trip_id, city_id, position, nights)
  select v_new, d.city_id, d.position, d.nights from public.trip_destinations d where d.trip_id = p_src;

  -- Jours décalés à la nouvelle date, avec une correspondance ancien jour → nouveau jour pour y ranger les étapes.
  select coalesce(jsonb_object_agg(d.id::text, gen_random_uuid()), '{}'::jsonb) into v_map
  from public.trip_days d where d.trip_id = p_src;

  insert into public.trip_days (id, trip_id, day_date, city_id, depart_time, return_time)
  select (v_map ->> d.id::text)::uuid, v_new, d.day_date + v_shift, d.city_id, d.depart_time, d.return_time
  from public.trip_days d where d.trip_id = p_src;

  if coalesce(array_length(p_plans, 1), 0) > 0 then
    insert into public.trip_items (trip_id, day_id, plan, place_id, title, category_code, start_time, duration_min, position, note)
    select v_new, (v_map ->> i.day_id::text)::uuid, i.plan, i.place_id, i.title, i.category_code, i.start_time, i.duration_min, i.position, i.note
    from public.trip_items i
    where i.trip_id = p_src and i.plan = any (p_plans)
      and (i.place_id is not null or nullif(btrim(i.title), '') is not null);   -- étape dont le lieu a disparu : ignorée
  end if;

  if p_budget then
    insert into public.trip_budget_lines (trip_id, poste, amount)
    select v_new, b.poste, b.amount from public.trip_budget_lines b where b.trip_id = p_src;
  end if;

  return v_new;
end $$;
revoke all on function public.copy_trip_rows(uuid, text, date, text[], boolean, boolean) from public, anon, authenticated;

-- Refaire son propre voyage.
create or replace function public.copy_trip(p_trip uuid, p_title text, p_start date, p_program boolean default true, p_budget boolean default true)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_trip_member(p_trip) then
    raise exception 'Seuls les voyageurs de ce voyage peuvent le refaire.' using errcode = '42501';
  end if;
  return public.copy_trip_rows(p_trip, p_title, p_start,
    case when p_program then array['A', 'B', 'C'] else array[]::text[] end, coalesce(p_budget, false), true);
end $$;
revoke all on function public.copy_trip(uuid, text, date, boolean, boolean) from public, anon;
grant execute on function public.copy_trip(uuid, text, date, boolean, boolean) to authenticated;

-- Refaire le voyage d'un ami à partir de son lien de partage (encore valide).
create or replace function public.copy_shared_trip(p_token text, p_start date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  select s.trip_id into v_trip
  from public.trip_shares s join public.trips t on t.id = s.trip_id
  where s.token = p_token and s.revoked_at is null and t.deleted_at is null;
  if v_trip is null then
    raise exception 'Ce lien de partage n''existe pas ou a été retiré.' using errcode = 'P0002';
  end if;
  return public.copy_trip_rows(v_trip, null, p_start, array['A'], false, false);
end $$;
revoke all on function public.copy_shared_trip(text, date) from public, anon;
grant execute on function public.copy_shared_trip(text, date) to authenticated;
