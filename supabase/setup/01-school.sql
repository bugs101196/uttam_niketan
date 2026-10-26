-- Uttam Niketan: one-time production setup (school, academic year, classes, sections).
-- Run ONCE in the Supabase SQL Editor, AFTER the three migration files.
-- Creates no students. Class names are provisional; adjust the list below
-- before running if the school uses different names or more sections.

do $$
declare
  v_school uuid;
  v_year uuid;
begin
  if exists (select 1 from public.schools) then
    raise exception 'A school already exists, so this setup has already been run.';
  end if;

  insert into public.schools (name, name_hi, timezone, default_language)
  values ('Uttam Niketan', 'उत्तम निकेतन', 'Asia/Kolkata', 'hi')
  returning id into v_school;

  insert into public.academic_years (school_id, name, start_date, end_date, is_active)
  values (v_school, '2026-27', '2026-04-01', '2027-03-31', true)
  returning id into v_year;

  with class_names(name, sort_order) as (
    values
      ('Nursery', 0), ('LKG', 1), ('UKG', 2),
      ('Class 1', 3), ('Class 2', 4), ('Class 3', 5), ('Class 4', 6),
      ('Class 5', 7), ('Class 6', 8), ('Class 7', 9), ('Class 8', 10)
  ),
  new_classes as (
    insert into public.classes (school_id, academic_year_id, name, sort_order)
    select v_school, v_year, name, sort_order from class_names
    returning id
  )
  insert into public.sections (class_id, school_id, academic_year_id, name)
  select id, v_school, v_year, 'A' from new_classes;
end;
$$;

-- Shows what was created.
select c.name as class, s.name as section
from public.sections s
join public.classes c on c.id = s.class_id
order by c.sort_order, s.name;
