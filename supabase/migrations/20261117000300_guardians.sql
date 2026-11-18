-- Uttam Niketan: parent/guardian identity and child linking
-- See docs/ERP_ARCHITECTURE.md §7.2, §8.3-8.4, §13.6.
--
-- Deliberately separate from `profiles`/`app_role`: a guardian is never a
-- staff member, and nothing here can be confused with staff access. A
-- guardian account is provisioned by an admin (same service-role pattern as
-- createStaffAccount for teachers), then the parent signs in with phone OTP
-- against that already-existing account — no public self-registration, and
-- no child is ever linked by inferring it from students.guardian_phone
-- (that column exists only to address WhatsApp absence alerts).

create table public.guardians (
  id uuid primary key references auth.users (id) on delete restrict,
  school_id uuid not null references public.schools (id),
  full_name text not null check (btrim(full_name) <> ''),
  -- E.164 format, e.g. +919876543210 — same format already used by students.guardian_phone.
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  preferred_language public.app_language not null default 'hi',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, phone)
);

create index guardians_school_idx on public.guardians (school_id);

create trigger guardians_set_updated_at
  before update on public.guardians
  for each row execute function private.set_updated_at();

-- A guardian can never change their own school or active status, mirroring
-- private.protect_profile_fields() for staff profiles.
create function private.protect_guardian_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.school_id is distinct from old.school_id then
    raise exception 'A guardian cannot change school' using errcode = '42501';
  end if;
  if new.id = (select auth.uid()) and new.is_active is distinct from old.is_active then
    raise exception 'You cannot change your own active status' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guardians_protect_fields
  before update on public.guardians
  for each row execute function private.protect_guardian_fields();

-- ---------------------------------------------------------------------------
-- guardian_students: who may see which children. Admin-managed only; never
-- self-service, never inferred from a phone-number match.
-- ---------------------------------------------------------------------------

create table public.guardian_students (
  guardian_id uuid not null references public.guardians (id),
  student_id uuid not null references public.students (id),
  -- Free text in the school's own wording, e.g. "Father", "Mother", "Guardian".
  relationship text,
  created_at timestamptz not null default now(),
  primary key (guardian_id, student_id)
);

create index guardian_students_student_idx on public.guardian_students (student_id);

-- ---------------------------------------------------------------------------
-- Authorization helper for everything parent-facing (attendance, homework,
-- fees) starting with the next migrations. Mirrors private.is_assigned_to_section.
-- ---------------------------------------------------------------------------

create function private.is_guardian_of(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_students gs
    join public.guardians g on g.id = gs.guardian_id
    where gs.student_id = p_student_id
      and gs.guardian_id = (select auth.uid())
      and g.is_active
  );
$$;

grant execute on function private.is_guardian_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.guardians from anon, authenticated;
revoke all on public.guardian_students from anon, authenticated;

grant select, update on public.guardians to authenticated;
grant select on public.guardian_students to authenticated;

alter table public.guardians enable row level security;
alter table public.guardian_students enable row level security;

-- guardians: a guardian reads their own row; an admin reads/manages their
-- school's guardians. No office access — not granted by the confirmed scope.
create policy guardians_select on public.guardians
  for select to authenticated
  using (
    id = (select auth.uid())
    or (school_id = (select private.current_school_id()) and (select private.is_admin()))
  );

create policy guardians_update_admin on public.guardians
  for update to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()))
  with check (school_id = (select private.current_school_id()));

-- guardian_students: a guardian reads their own links; an admin reads/manages
-- links for students and guardians in their own school.
create policy guardian_students_select on public.guardian_students
  for select to authenticated
  using (
    guardian_id = (select auth.uid())
    or exists (
      select 1 from public.students st
      where st.id = guardian_students.student_id
        and st.school_id = (select private.current_school_id())
        and (select private.is_admin())
    )
  );

create policy guardian_students_insert_admin on public.guardian_students
  for insert to authenticated
  with check (
    (select private.is_admin())
    and exists (
      select 1 from public.guardians g
      where g.id = guardian_students.guardian_id and g.school_id = (select private.current_school_id())
    )
    and exists (
      select 1 from public.students st
      where st.id = guardian_students.student_id and st.school_id = (select private.current_school_id())
    )
  );

create policy guardian_students_delete_admin on public.guardian_students
  for delete to authenticated
  using (
    (select private.is_admin())
    and exists (
      select 1 from public.students st
      where st.id = guardian_students.student_id and st.school_id = (select private.current_school_id())
    )
  );
