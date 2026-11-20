-- Uttam Niketan: homework (ERP Architecture §18 phase 4)
-- One table, per-section, per docs/ERP_ARCHITECTURE.md's role matrix:
--   Create/edit: admin (any section), teacher (own assigned sections only)
--   View: admin + office (school-wide), teacher (assigned sections),
--         guardian (their own linked children's sections)
-- "Receptionist" in the architecture doc's matrix maps to this codebase's
-- real `office` role (the doc predates/uses different naming than the
-- actually-implemented app_role enum -- same mapping already used for
-- Phase 1). Description is bilingual (two plain columns, not jsonb) per
-- §13.6's "data fields needing both languages" guidance, matching this
-- schema's existing flat-column style elsewhere. No attachments in this
-- pass -- the architecture doc calls the storage bucket "optional" and
-- Phase 4 is scoped as "small, no financial risk" (§18); can be added
-- later as its own migration without touching this one.

create table public.homework (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  section_id uuid not null references public.sections (id),
  subject text not null check (btrim(subject) <> ''),
  description_en text not null check (btrim(description_en) <> ''),
  description_hi text not null check (btrim(description_hi) <> ''),
  due_date date not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index homework_section_idx on public.homework (section_id, due_date desc);

create trigger homework_set_updated_at
  before update on public.homework
  for each row execute function private.set_updated_at();

revoke all on public.homework from anon, authenticated;
grant select, insert, update, delete on public.homework to authenticated;

alter table public.homework enable row level security;

-- View: admin/office school-wide, assigned teacher, or a guardian of a
-- student in this section.
create policy homework_select on public.homework
  for select to authenticated
  using (
    (school_id = (select private.current_school_id()) and (select private.is_office_or_admin()))
    or private.is_assigned_to_section(section_id)
    or exists (
      select 1 from public.students st
      where st.section_id = homework.section_id
        and private.is_guardian_of(st.id)
    )
  );

-- Create: admin (any section in their school) or the assigned teacher
-- posting as themselves. Office is deliberately excluded -- the matrix
-- grants office view-only, same reasoning as every other admin-vs-office
-- boundary in this codebase.
create policy homework_insert on public.homework
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (school_id = (select private.current_school_id()) and (select private.is_admin()))
      or private.is_assigned_to_section(section_id)
    )
  );

-- Edit: admin (any), or the original teacher author on their own assigned
-- section -- deliberately narrower than "any assigned teacher," so one
-- teacher on a co-taught section can't silently change another's post.
-- Not explicit in the architecture doc's matrix; revisit if the school
-- needs shared editing.
create policy homework_update on public.homework
  for update to authenticated
  using (
    (school_id = (select private.current_school_id()) and (select private.is_admin()))
    or (created_by = (select auth.uid()) and private.is_assigned_to_section(section_id))
  )
  with check (
    (school_id = (select private.current_school_id()) and (select private.is_admin()))
    or (created_by = (select auth.uid()) and private.is_assigned_to_section(section_id))
  );

-- Delete: admin only. Not mentioned in the matrix at all -- erring
-- conservative rather than inventing teacher-delete rights.
create policy homework_delete on public.homework
  for delete to authenticated
  using (school_id = (select private.current_school_id()) and (select private.is_admin()));
