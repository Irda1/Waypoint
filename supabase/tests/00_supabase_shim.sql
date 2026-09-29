-- Waypoint · tests locaux : imite le strict minimum de Supabase sur un PostgreSQL nu
-- (rôles anon / authenticated / service_role, schéma auth, auth.uid(), publication
-- Realtime, droits par défaut). N'est JAMAIS appliqué sur un vrai projet Supabase.

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;
create schema if not exists extensions;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Même logique que auth.uid() de Supabase (claim `sub`)
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create publication supabase_realtime;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;

-- Droits par défaut de Supabase : tout est accordé, c'est la RLS et les REVOKE
-- des migrations qui restreignent.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
