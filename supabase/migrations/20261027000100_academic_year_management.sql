-- Uttam Niketan: academic year management
-- Two admin operations that must be atomic, so they are database functions:
--   * switching the active academic year (at most one is active, enforced by a
--     unique index; deactivate + activate must happen together);
--   * copying the class and section structure from one year into a new year.
-- Plain class/section create, rename and delete use the existing admin RLS
-- policies; foreign keys (no cascades) refuse deletes that would orphan
-- students, attendance or teacher assignments.

create function public.set_active_academic_year(p_year_id uuid)
returns public.academic_years
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year public.academic_years;
begin
  select * into v_year from public.academic_years where id = p_year_id for update;
  if not found or v_year.school_id is distinct from private.current_school_id() or not private.is_admin() then
    raise exception 'Only an administrator of this school can change the active year' using errcode = '42501';
  end if;

  update public.academic_years
  set is_active = false
  where school_id = v_year.school_id and is_active and id <> v_year.id;

  update public.academic_years set is_active = true where id = v_year.id returning * into v_year;

  insert into public.audit_logs (school_id, actor_id, action, entity_type, entity_id, details)
  values (v_year.school_id, (select auth.uid()), 'academic_year.activated', 'academic_year', v_year.id,
          jsonb_build_object('name', v_year.name));

  return v_year;
end;
$$;

-- Copies every class (name, order) and its sections from one year into
-- another year of the same school. The target year must have no classes yet.
-- Returns the number of sections created. Students are not moved.
create function public.copy_class_structure(p_from_year uuid, p_to_year uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.academic_years;
  v_to public.academic_years;
  v_sections integer;
begin
  select * into v_from from public.academic_years where id = p_from_year;
  select * into v_to from public.academic_years where id = p_to_year;
  if v_from.id is null or v_to.id is null
     or v_from.school_id is distinct from private.current_school_id()
     or v_to.school_id is distinct from v_from.school_id
     or not private.is_admin() then
    raise exception 'Only an administrator of this school can copy classes' using errcode = '42501';
  end if;
  if v_from.id = v_to.id then
    raise exception 'Choose a different year to copy into' using errcode = '22023';
  end if;
  if exists (select 1 from public.classes where academic_year_id = v_to.id) then
    raise exception 'The target year already has classes' using errcode = '55000';
  end if;

  with new_classes as (
    insert into public.classes (school_id, academic_year_id, name, sort_order)
    select c.school_id, v_to.id, c.name, c.sort_order
    from public.classes c
    where c.academic_year_id = v_from.id
    returning id, name
  ),
  mapping as (
    select old.id as old_id, nc.id as new_id
    from public.classes old
    join new_classes nc on lower(nc.name) = lower(old.name)
    where old.academic_year_id = v_from.id
  ),
  new_sections as (
    insert into public.sections (class_id, school_id, academic_year_id, name)
    select m.new_id, s.school_id, v_to.id, s.name
    from public.sections s
    join mapping m on m.old_id = s.class_id
    returning 1
  )
  select count(*) into v_sections from new_sections;

  return v_sections;
end;
$$;

revoke all on function
  public.set_active_academic_year(uuid),
  public.copy_class_structure(uuid, uuid)
from public, anon;

grant execute on function
  public.set_active_academic_year(uuid),
  public.copy_class_structure(uuid, uuid)
to authenticated;
