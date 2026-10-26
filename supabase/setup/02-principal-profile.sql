-- Uttam Niketan: make the principal an admin.
-- First create the user in Supabase: Authentication -> Users -> Add user ->
-- Create new user (tick "Auto Confirm User"). Then change the two values
-- below and run this in the SQL Editor.

insert into public.profiles (id, school_id, full_name, role)
select u.id, s.id, 'PRINCIPAL FULL NAME', 'admin'
from auth.users u
cross join public.schools s
where u.email = lower('principal@example.com');

-- Should show exactly one row with role "admin".
select p.full_name, u.email, p.role, p.is_active
from public.profiles p
join auth.users u on u.id = p.id;
