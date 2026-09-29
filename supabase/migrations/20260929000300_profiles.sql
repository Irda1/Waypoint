-- Waypoint · migration 0300 : profils
--
-- Les comptes (email + mot de passe, Google) vivent dans auth.users, géré par
-- l'authentification de Supabase : l'app ne stocke jamais de mot de passe.
-- `profiles` ne garde que ce que l'app affiche.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default 'Voyageur' check (length(btrim(display_name)) between 1 and 60),
  avatar_url    text,
  home_country  char(2) references public.countries (code) on delete set null,
  locale        text not null default 'fr',
  currency      char(3) not null default 'EUR',
  accent        text not null default 'soleil' check (accent in ('soleil', 'turquoise', 'corail', 'lavande')),
  theme         text not null default 'auto' check (theme in ('auto', 'nuit', 'jour')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Création automatique du profil à l'inscription (email ou Google).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := nullif(btrim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(coalesce(new.email, ''), '@', 1)
  )), '');

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(v_name, 'Voyageur'), 60),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
