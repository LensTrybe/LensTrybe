-- Guard triggers must see the caller's role. Inside a SECURITY DEFINER function
-- current_user is the function owner, so these run as SECURITY INVOKER instead.
alter function public.messages_guard_update() security invoker;
alter function public.message_threads_guard_update() security invoker;
alter function public.reviews_guard_update() security invoker;

-- reviews_before_insert needs definer rights (writes review_contacts), so it keys
-- off the request's JWT role instead of current_user.
create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(NEW.reviewer_email, '')));
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if coalesce(NEW.source, 'platform') = 'platform' then
      if v_email <> '' and exists (
        select 1 from public.review_contacts rc
         where rc.creative_id = NEW.creative_id and lower(rc.reviewer_email) = v_email
           and rc.created_at > now() - interval '90 days') then
        raise exception 'You have already reviewed this creative recently.';
      end if;
      if (select count(*) from public.reviews r
           where r.creative_id = NEW.creative_id and r.source = 'platform'
             and r.created_at > now() - interval '1 hour') >= 10 then
        raise exception 'Too many reviews right now. Please try again later.';
      end if;
    end if;
    NEW.flagged := false; NEW.flag_reason := null; NEW.flag_status := 'none'; NEW.flagged_at := null;
    NEW.hidden := false; NEW.notified_at := null; NEW.created_at := now();
    NEW.body := left(NEW.body, 3000); NEW.comment := left(NEW.comment, 3000);
    NEW.reviewer_name := left(NEW.reviewer_name, 120); NEW.client_name := left(NEW.client_name, 120);
  end if;
  if v_email <> '' then
    insert into public.review_contacts (review_id, creative_id, reviewer_email)
    values (NEW.id, NEW.creative_id, v_email) on conflict (review_id) do nothing;
  end if;
  NEW.reviewer_email := null;
  return NEW;
end $$;
revoke execute on function public.reviews_before_insert() from public, anon, authenticated;
