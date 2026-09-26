-- Marketplace (LensTrybe Next). Server-side rules for marketplace_listings written from the browser:
--  * the seller is always the signed-in user; created_at can't be set or changed
--  * status is 'active' or 'sold'; relisting a sold item counts against the plan's listing limit
--    (guard_tier_count only runs on insert)
--  * sane lengths and price; up to 5 photos, each a public URL in the seller's own marketplace folder
-- Photos bucket: 10 MB, jpeg/png/webp only.

update public.marketplace_listings set status = 'active' where status is null;
alter table public.marketplace_listings drop constraint if exists marketplace_listings_status_check;
alter table public.marketplace_listings add constraint marketplace_listings_status_check check (status in ('active', 'sold'));

update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'marketplace';

create or replace function public.guard_marketplace_listing() returns trigger
language plpgsql set search_path = public as $$
declare v_cap int; v_used int; v_prefix text; v_p jsonb;
begin
  if current_user not in ('anon', 'authenticated') then return NEW; end if;
  if auth.uid() is null then raise exception 'Please log in again.' using errcode = '42501'; end if;
  if TG_OP = 'INSERT' then
    NEW.id := gen_random_uuid(); NEW.creative_id := auth.uid(); NEW.created_at := now(); NEW.status := 'active';
  else
    NEW.id := OLD.id; NEW.creative_id := OLD.creative_id; NEW.created_at := OLD.created_at;
    if NEW.status = 'active' and OLD.status is distinct from 'active' then
      v_cap := public.tier_cap(auth.uid(), 'marketplace_listings');
      if v_cap is not null then
        select count(*) into v_used from public.marketplace_listings where creative_id = auth.uid() and status = 'active' and id <> NEW.id;
        if v_used >= v_cap then raise exception 'TIER_LIMIT:marketplace_listings' using errcode = 'P0001', hint = format('This plan allows %s.', v_cap); end if;
      end if;
    end if;
  end if;
  NEW.updated_at := now();
  NEW.title := left(btrim(coalesce(NEW.title, '')), 150);
  if NEW.title = '' then raise exception 'Give the listing a title.' using errcode = 'P0001'; end if;
  NEW.category := left(btrim(coalesce(NEW.category, 'Other')), 60);
  NEW.condition := left(btrim(coalesce(NEW.condition, 'Good')), 30);
  NEW.description := left(NEW.description, 3000);
  NEW.location := left(NEW.location, 120);
  if NEW.price is null or NEW.price < 0 or NEW.price > 1000000 then raise exception 'Add a price.' using errcode = 'P0001'; end if;
  if NEW.photos is null or jsonb_typeof(NEW.photos) <> 'array' then NEW.photos := '[]'::jsonb; end if;
  if jsonb_array_length(NEW.photos) > 5 then raise exception 'Up to 5 photos.' using errcode = 'P0001'; end if;
  v_prefix := '/storage/v1/object/public/marketplace/' || NEW.creative_id::text || '/';
  for v_p in select * from jsonb_array_elements(NEW.photos) loop
    if jsonb_typeof(v_p) <> 'string' or position(v_prefix in (v_p #>> '{}')) = 0 or length(v_p #>> '{}') > 600 then
      raise exception 'Those photos can''t be used. Upload them again.' using errcode = 'P0001';
    end if;
  end loop;
  return NEW;
end $$;

drop trigger if exists b_guard_marketplace_listing on public.marketplace_listings;
create trigger b_guard_marketplace_listing before insert or update on public.marketplace_listings
  for each row execute function public.guard_marketplace_listing();
