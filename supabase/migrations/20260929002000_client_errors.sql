-- Waypoint · migration 2000 : remontée des erreurs de l'appli
--
-- Quand l'appli plante (téléphone ou site), elle envoie un court rapport : message, pile d'appels, écran,
-- plateforme et numéro de build ; aucun contenu de voyage n'est joint. À lire dans Supabase > Table Editor > client_errors.
-- Garde-fous : connexion requise, textes tronqués, 30 rapports par personne et par 24 h au plus,
-- rapports effacés après 30 jours et avec le compte (cascade). L'appli ne peut ni lire ni modifier la table.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 1900.
-- Sans elle l'appli marche comme avant : l'envoi échoue sans bruit.

create table public.client_errors (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  message     text not null,
  stack       text,
  screen      text,
  platform    text,
  build       text,
  fatal       boolean not null default false
);
create index client_errors_created_idx on public.client_errors (created_at);
create index client_errors_user_idx on public.client_errors (user_id, created_at);

-- Aucune politique : rien n'est lisible ni modifiable depuis l'appli, l'écriture passe par log_client_error.
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

create or replace function public.log_client_error(
  p_message text, p_stack text default null, p_screen text default null,
  p_platform text default null, p_build text default null, p_fatal boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or coalesce(btrim(p_message), '') = '' then
    return;
  end if;
  -- Une boucle d'erreurs ne remplit pas la base.
  if (select count(*) from public.client_errors where user_id = v_uid and created_at > now() - interval '1 day') >= 30 then
    return;
  end if;
  insert into public.client_errors (user_id, message, stack, screen, platform, build, fatal)
  values (v_uid, left(p_message, 500), left(p_stack, 4000), left(p_screen, 200), left(p_platform, 20), left(p_build, 40), coalesce(p_fatal, false));
  delete from public.client_errors where created_at < now() - interval '30 days';
end;
$$;

revoke all on function public.log_client_error(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.log_client_error(text, text, text, text, text, boolean) to authenticated;
