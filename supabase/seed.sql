-- Development seed data. ALL PEOPLE BELOW ARE FICTIONAL.
-- Never put real student or guardian details in this file.
--
-- Staff accounts are not seeded here: they need Supabase Auth users, which are
-- provisioned through the admin provisioning flow (Week 2).
--
-- Class names are provisional until the school confirms its naming
-- (see docs/PROJECT_ROADMAP.md §3, "Items requiring confirmation").

insert into public.schools (id, name, name_hi, timezone, default_language)
values (
  '00000000-0000-4000-8000-000000000001',
  'Uttam Niketan',
  'उत्तम निकेतन',
  'Asia/Kolkata',
  'hi'
);

insert into public.academic_years (id, school_id, name, start_date, end_date, is_active)
values (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000001',
  '2026-27',
  '2026-04-01',
  '2027-03-31',
  true
);

-- Nursery, LKG, UKG and Class 1-8, each with a single section "A".
with class_names(name, sort_order) as (
  values
    ('Nursery', 0), ('LKG', 1), ('UKG', 2),
    ('Class 1', 3), ('Class 2', 4), ('Class 3', 5), ('Class 4', 6),
    ('Class 5', 7), ('Class 6', 8), ('Class 7', 9), ('Class 8', 10)
),
inserted_classes as (
  insert into public.classes (school_id, academic_year_id, name, sort_order)
  select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', name, sort_order
  from class_names
  returning id, school_id, academic_year_id
)
insert into public.sections (class_id, school_id, academic_year_id, name)
select id, school_id, academic_year_id, 'A' from inserted_classes;

-- Five fictional students in every section.
with first_names(n, name) as (
  values (1, 'Aarav'), (2, 'Diya'), (3, 'Kabir'), (4, 'Ananya'), (5, 'Vihaan')
),
roster as (
  select
    s.id as section_id,
    c.id as class_id,
    c.sort_order,
    f.n,
    f.name
  from public.sections s
  join public.classes c on c.id = s.class_id
  cross join first_names f
)
insert into public.students (
  school_id, admission_no, full_name, class_id, section_id, roll_no,
  guardian_name, guardian_phone, preferred_language, guardian_notifications_consent
)
select
  '00000000-0000-4000-8000-000000000001',
  format('TEST-%s-%s', lpad(sort_order::text, 2, '0'), lpad(n::text, 2, '0')),
  format('%s Test %s', name, sort_order),
  class_id,
  section_id,
  n,
  format('Guardian of %s', name),
  -- +91 99999 xxxxx is used only for fictional test data.
  format('+9199999%s%s', lpad(sort_order::text, 3, '0'), lpad(n::text, 2, '0')),
  case when n % 2 = 0 then 'en' else 'hi' end::public.app_language,
  false
from roster;
