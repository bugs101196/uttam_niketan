-- Uttam Niketan: core schema
-- Tables, enums, integrity constraints and indexes for the school management app.
-- See docs/PROJECT_ROADMAP.md §6 for the blueprint this implements.
--
-- Integrity principles:
--   * UUID primary keys, timestamptz audit columns.
--   * School / academic-year consistency is enforced with composite foreign keys,
--     so a section can never point at a class from another school or year.
--   * No ON DELETE CASCADE anywhere: historical attendance must never disappear
--     because a parent row was deleted. Deletes of referenced rows are rejected.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'teacher');
create type public.app_language as enum ('en', 'hi');
create type public.enrollment_status as enum ('active', 'inactive', 'transferred');
create type public.attendance_session_status as enum ('draft', 'submitted', 'locked');
create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  name_hi text,
  timezone text not null default 'Asia/Kolkata',
  default_language public.app_language not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles (one per staff auth user; no public self-registration)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  school_id uuid not null references public.schools (id),
  full_name text not null check (btrim(full_name) <> ''),
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, school_id)
);

create index profiles_school_idx on public.profiles (school_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- academic_years
-- ---------------------------------------------------------------------------

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  name text not null check (btrim(name) <> ''),
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date),
  unique (school_id, name),
  unique (id, school_id)
);

-- At most one active academic year per school.
create unique index academic_years_one_active_per_school
  on public.academic_years (school_id) where is_active;

create trigger academic_years_set_updated_at
  before update on public.academic_years
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_year_id uuid not null,
  name text not null check (btrim(name) <> '' and name = btrim(name)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (academic_year_id, school_id) references public.academic_years (id, school_id),
  unique (id, school_id),
  unique (id, school_id, academic_year_id)
);

-- "Class 1" and "class 1" are the same class within a year.
create unique index classes_unique_name_per_year
  on public.classes (academic_year_id, lower(name));

create trigger classes_set_updated_at
  before update on public.classes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- sections
-- school_id / academic_year_id are denormalised from the class and kept
-- consistent by the composite foreign key, which keeps RLS checks cheap.
-- ---------------------------------------------------------------------------

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  school_id uuid not null,
  academic_year_id uuid not null,
  name text not null check (btrim(name) <> '' and name = btrim(name)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (class_id, school_id, academic_year_id)
    references public.classes (id, school_id, academic_year_id),
  unique (id, class_id),
  unique (id, school_id),
  unique (id, school_id, academic_year_id)
);

create unique index sections_unique_name_per_class
  on public.sections (class_id, lower(name));

create trigger sections_set_updated_at
  before update on public.sections
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- students
-- Only the fields the school needs for records and absence notifications.
-- ---------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  admission_no text not null check (btrim(admission_no) <> '' and admission_no = btrim(admission_no)),
  full_name text not null check (btrim(full_name) <> ''),
  class_id uuid not null,
  section_id uuid not null,
  roll_no integer check (roll_no > 0),
  guardian_name text,
  -- E.164 format, e.g. +919876543210
  guardian_phone text check (guardian_phone ~ '^\+[1-9][0-9]{7,14}$'),
  preferred_language public.app_language not null default 'hi',
  guardian_notifications_consent boolean not null default false,
  enrollment_status public.enrollment_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The section must belong to the chosen class...
  foreign key (section_id, class_id) references public.sections (id, class_id),
  -- ...and the class must belong to the student's school.
  foreign key (class_id, school_id) references public.classes (id, school_id),
  unique (id, school_id)
);

-- Admission numbers are unique per school, ignoring case.
create unique index students_unique_admission_no
  on public.students (school_id, upper(admission_no));

-- Roll numbers are unique among active students of a section.
create unique index students_unique_active_roll_no
  on public.students (section_id, roll_no)
  where enrollment_status = 'active' and roll_no is not null;

create index students_section_idx on public.students (section_id, enrollment_status);
create index students_class_idx on public.students (class_id);
create index students_name_idx on public.students (school_id, lower(full_name));

create trigger students_set_updated_at
  before update on public.students
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- teacher_assignments
-- ---------------------------------------------------------------------------

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  teacher_id uuid not null,
  section_id uuid not null,
  academic_year_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (teacher_id, school_id) references public.profiles (id, school_id),
  foreign key (section_id, school_id, academic_year_id)
    references public.sections (id, school_id, academic_year_id),
  unique (teacher_id, section_id, academic_year_id)
);

create index teacher_assignments_section_idx on public.teacher_assignments (section_id);

-- Only profiles with the teacher role can be assigned to sections.
create function private.check_teacher_assignment_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.teacher_id and p.role = 'teacher'
  ) then
    raise exception 'Assigned user must have the teacher role'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger teacher_assignments_check_role
  before insert or update on public.teacher_assignments
  for each row execute function private.check_teacher_assignment_role();

-- ---------------------------------------------------------------------------
-- attendance_sessions: one per section per day
-- ---------------------------------------------------------------------------

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  section_id uuid not null,
  attendance_date date not null,
  status public.attendance_session_status not null default 'draft',
  created_by uuid not null references public.profiles (id),
  submitted_by uuid references public.profiles (id),
  submitted_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (section_id, school_id) references public.sections (id, school_id),
  unique (section_id, attendance_date),
  unique (id, section_id),
  -- Draft sessions carry no submission data; submitted/locked ones always do.
  check (
    (status = 'draft' and submitted_by is null and submitted_at is null)
    or (status <> 'draft' and submitted_by is not null and submitted_at is not null)
  ),
  check ((status = 'locked') = (locked_at is not null))
);

create index attendance_sessions_school_date_idx
  on public.attendance_sessions (school_id, attendance_date);

create trigger attendance_sessions_set_updated_at
  before update on public.attendance_sessions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- attendance_records: one per student per session
-- section_id records where the student was when attendance was taken, so
-- history survives promotions and section changes.
-- ---------------------------------------------------------------------------

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  section_id uuid not null,
  student_id uuid not null references public.students (id),
  status public.attendance_status not null,
  marked_by uuid not null references public.profiles (id),
  marked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, section_id) references public.attendance_sessions (id, section_id),
  unique (session_id, student_id)
);

create index attendance_records_student_idx on public.attendance_records (student_id);

create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs: append-only
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools (id),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_school_created_idx on public.audit_logs (school_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create function private.prevent_audit_log_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_log_change();
