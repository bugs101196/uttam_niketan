-- Uttam Niketan: add the "office" staff role
-- See docs/ERP_ARCHITECTURE.md §8.2. Office staff get attendance-marking
-- parity with admin, but no financial, settings, or staff-management access.
--
-- Split into its own migration: Postgres will not let a newly added enum
-- value be referenced in the same transaction that adds it, so the functions
-- and policies that use 'office' live in the next migration file.

alter type public.app_role add value 'office';
