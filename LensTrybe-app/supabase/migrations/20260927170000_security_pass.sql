-- Security pass (27 Sep), agreed with Michael:
--  * storage limits on the buckets that had none (types from what both sites upload; deliveries left open)
--  * find_client_account_id: only creatives can look an email up (was any signed-in user)
--  * founding_job_count / founding_listing_complete: only for yourself, staff, or the service role
--  * fixed search_path on two trigger functions

update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'] where id in ('avatars','covers','brand-logos','brand-kit');
update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'] where id = 'portfolio-website';
update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'] where id = 'inventory';
update storage.buckets set file_size_limit = 524288000, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/webm'] where id = 'portfolio';
update storage.buckets set file_size_limit = 524288000, allowed_mime_types = array['video/mp4','video/quicktime','video/webm'] where id = 'portfolio-videos';
update storage.buckets set file_size_limit = 20971520, allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'] where id = 'credentials';
update storage.buckets set file_size_limit = 26214400, allowed_mime_types = array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'] where id = 'contracts';

create or replace function public.find_client_account_id(p_email text) returns uuid
language sql stable security definer set search_path to 'public' as $function$
  select id from public.client_accounts
   where auth.uid() is not null
     and exists (select 1 from public.profiles me where me.id = auth.uid() and coalesce(me.account_type, 'creative') = 'creative')
     and lower(email) = lower(btrim(p_email))
   limit 1
$function$;

create or replace function public.founding_job_count(p_id uuid) returns integer
language sql stable security definer set search_path to 'public' as $function$
  with own as (select lower(coalesce(business_email, '')) as em from public.profiles where id = p_id),
  accepted as (
    select distinct lower(client_email) as em from public.quotes
    where creative_id = p_id and lower(status) = 'accepted'
      and client_email is not null and trim(client_email) <> ''
  ),
  paid as (
    select distinct lower(client_email) as em from public.invoices
    where creative_id = p_id and lower(status) = 'paid'
      and client_email is not null and trim(client_email) <> ''
  )
  select case when auth.uid() is null or auth.uid() = p_id or public.is_staff() then (
    select count(*)::int from accepted a
    join paid pd on pd.em = a.em
    where a.em <> coalesce((select em from own), '')
  ) else 0 end
$function$;

create or replace function public.founding_listing_complete(p_id uuid) returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select
    coalesce(nullif(trim(p.avatar_url), ''), '') <> ''
    and coalesce(nullif(trim(p.business_name), ''), '') <> ''
    and coalesce(nullif(trim(p.tagline), ''), '') <> ''
    and length(trim(coalesce(p.bio, ''))) >= 40
    and coalesce(array_length(p.skill_types, 1), 0) >= 1
    and coalesce(array_length(p.specialties, 1), 0) >= 1
    and coalesce(nullif(trim(p.city), ''), '') <> ''
    and coalesce(nullif(trim(p.state), ''), '') <> ''
    and (coalesce(nullif(trim((select pp.phone from public.profile_private pp where pp.id = p.id)), ''), '') <> ''
         or coalesce(nullif(trim(p.website), ''), '') <> '')
    and (
      coalesce(nullif(trim(p.instagram_url), ''), '') <> '' or
      coalesce(nullif(trim(p.tiktok_url), ''), '') <> '' or
      coalesce(nullif(trim(p.linkedin_url), ''), '') <> '' or
      coalesce(nullif(trim(p.facebook_url), ''), '') <> '' or
      coalesce(nullif(trim(p.twitter_url), ''), '') <> ''
    )
    and (select count(*) from public.portfolio_items pi where pi.creative_id = p.id or pi.user_id = p.id) >= 8
  from public.profiles p where p.id = p_id
    and (auth.uid() is null or auth.uid() = p_id or public.is_staff())
$function$;

alter function public.shot_lists_touch() set search_path = public;
alter function public.profile_posters_touch() set search_path = public;
