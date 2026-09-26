-- Security pass (27 Sep): the signed-in creative's own full profile row, so private columns
-- (business_email, phone, abn, billing ids) can stop being readable through the profiles table
-- at the swap (see the swap checklist). Next's AuthContext loads the profile through this.
create or replace function public.my_profile() returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;
