-- Uttam Niketan: close a cross-tenant gap in Phase 4's homework table.
-- Caught by security review right after 20261118030000_homework.sql merged
-- (the fix commit lost a race with the PR merge, so it never landed in
-- that migration -- adding it here instead per the additive-only rule,
-- rather than editing an already-merged file).
--
-- school_id and section_id were independently checkable in RLS but never
-- required to agree, so an insert/update could tag a legitimate section
-- with a *different* school_id, leaking the row into that other school's
-- admin/office view. sections already has a matching `unique (id,
-- school_id)` (same denormalisation-kept-consistent pattern as
-- classes/sections), so a composite FK closes this at the DB level.

alter table public.homework
  add constraint homework_section_school_fk
  foreign key (section_id, school_id) references public.sections (id, school_id);
