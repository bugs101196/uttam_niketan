-- Minimal stand-in for the pieces of Supabase the migrations depend on, so the
-- real migration files can be tested against a plain PostgreSQL database.
-- Test-only: never apply this to a Supabase project, which already has these.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Mirrors Supabase: the user id comes from the request's JWT claims.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase's default privileges grant table access to the API roles; the
-- migrations then narrow them. Reproduce that starting point.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
