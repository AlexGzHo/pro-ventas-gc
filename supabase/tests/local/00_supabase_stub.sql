-- Imitación mínima de Supabase para pruebas locales (no es parte del proyecto).
do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $$;
create schema auth;
create table auth.users (
  id uuid primary key, email text, aud text, role text,
  raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now()
);
-- Misma lógica que auth.uid() de Supabase: lee el "sub" del JWT de la petición.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create extension if not exists pgcrypto; create extension if not exists "uuid-ossp";
