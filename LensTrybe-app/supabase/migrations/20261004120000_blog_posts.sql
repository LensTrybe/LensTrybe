-- The LensTrybe blog (4 Oct 2026). Weekly SEO posts live in the same table as The Trybe Edit
-- issues: kind = 'issue' is an Edit issue, kind = 'post' is a blog post for clients or creatives.
-- The writing chat inserts posts with approved = false, an admin previews them on the site, then
-- sets approved = true and a publish_at. Public read stays "approved and published".

alter table public.edit_issues
  add column if not exists kind text not null default 'issue',
  add column if not exists audience text,
  add column if not exists body_md text,
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists hero_url text,
  add column if not exists hero_alt text,
  add column if not exists category text,
  add column if not exists faq jsonb not null default '[]'::jsonb,
  add column if not exists cta_label text,
  add column if not exists cta_href text;

alter table public.edit_issues alter column n drop not null, alter column month drop not null;

alter table public.edit_issues drop constraint if exists edit_issues_kind_check;
alter table public.edit_issues add constraint edit_issues_kind_check check (kind in ('issue', 'post'));
alter table public.edit_issues drop constraint if exists edit_issues_audience_check;
alter table public.edit_issues add constraint edit_issues_audience_check check (audience is null or audience in ('clients', 'creatives'));
-- An issue needs its number and month; a post needs an audience, a body and its search wording.
alter table public.edit_issues drop constraint if exists edit_issues_shape_check;
alter table public.edit_issues add constraint edit_issues_shape_check check (
  (kind = 'issue' and n is not null and month is not null)
  or (kind = 'post' and audience is not null and nullif(trim(body_md), '') is not null
      and nullif(trim(meta_title), '') is not null and nullif(trim(meta_description), '') is not null)
);
-- /blog/clients, /blog/creatives and /blog/edit are the hub's own pages.
alter table public.edit_issues drop constraint if exists edit_issues_slug_check;
alter table public.edit_issues add constraint edit_issues_slug_check check (
  slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug not in ('clients', 'creatives', 'edit', 'confirm')
);
alter table public.edit_issues drop constraint if exists edit_issues_faq_check;
alter table public.edit_issues add constraint edit_issues_faq_check check (jsonb_typeof(faq) = 'array');

-- updated_at moves only when the words change, so approving or rescheduling a post does not
-- make it look "Updated" or bump the sitemap.
create or replace function public.edit_issues_touch()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'INSERT' then
    new.updated_at := coalesce(new.updated_at, now());
  elsif (new.title, new.dek, new.body_md, new.faq, new.sections, new.meta_title, new.meta_description, new.hero_url)
        is distinct from
        (old.title, old.dek, old.body_md, old.faq, old.sections, old.meta_title, old.meta_description, old.hero_url) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end $fn$;
drop trigger if exists edit_issues_touch on public.edit_issues;
create trigger edit_issues_touch before insert or update on public.edit_issues
  for each row execute function public.edit_issues_touch();

create index if not exists edit_issues_kind_audience_publish_idx
  on public.edit_issues (kind, audience, publish_at desc);

-- Admins can read drafts and scheduled rows so they can preview them on the site.
drop policy if exists blog_admin_read on public.edit_issues;
create policy blog_admin_read on public.edit_issues for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin));

-- Hero and inline images for posts: anyone can read, only admins upload.
insert into storage.buckets (id, name, public) values ('blog', 'blog', true)
  on conflict (id) do update set public = true;
drop policy if exists blog_images_insert on storage.objects;
create policy blog_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'blog' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin));
drop policy if exists blog_images_update on storage.objects;
create policy blog_images_update on storage.objects for update to authenticated
  using (bucket_id = 'blog' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin));
drop policy if exists blog_images_delete on storage.objects;
create policy blog_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'blog' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin));
