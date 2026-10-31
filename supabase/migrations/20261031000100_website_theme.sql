-- Website colour theme (change request CR-002).
--
-- The school admin picks one of a fixed set of tested colour themes; the
-- values are defined in src/lib/themes.ts and must match this check.
-- Admins already may update their own school row (schools_update_admin).

alter table public.schools
  add column website_theme text not null default 'maroon'
    check (website_theme in ('maroon', 'navy', 'green', 'blue', 'plum'));

-- The public website is read by signed-out visitors, who cannot see the
-- schools table. This exposes only the theme name of the deployment's school
-- (one school per deployment; the oldest row if more ever exist).
create function public.website_theme()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select sc.website_theme from public.schools sc order by sc.created_at limit 1;
$$;

revoke all on function public.website_theme() from public;
grant execute on function public.website_theme() to anon, authenticated;
