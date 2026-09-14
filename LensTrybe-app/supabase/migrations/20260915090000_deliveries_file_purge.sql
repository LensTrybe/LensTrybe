-- Nothing has ever removed an expired gallery's files. The link stops working, the bytes
-- stay, and delivery_bytes_used counts them regardless of expiry, so a creative's storage
-- allowance fills up with galleries they cannot open and the app asks them to upgrade.
--
-- Files now go 30 days after a gallery expires, with a warning a week before. The delivery
-- row stays either way: the client name, the title, the dates and the download counts are
-- the creative's business record, and only the files were ever the expensive part.

alter table public.deliveries
  add column if not exists purge_warning_sent boolean not null default false,
  add column if not exists files_purged_at timestamptz;

comment on column public.deliveries.files_purged_at is
  'When the gallery files were removed from storage, 30 days after expiry. The row is kept as the creative''s record.';
comment on column public.deliveries.purge_warning_sent is
  'Whether the creative has been told these files are about to be removed.';

-- Find it fast. Most deliveries are live, so only the ones with an expiry matter.
create index if not exists deliveries_expiry_purge_idx
  on public.deliveries (expires_at)
  where expires_at is not null and files_purged_at is null;

/**
 * A creative's used storage should only count files that still exist. Without this, a purged
 * gallery would keep eating their allowance and the whole exercise would be pointless.
 */
create or replace function public.delivery_bytes_used(p_creative uuid, p_exclude uuid default null::uuid)
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(sum((f->>'size')::bigint), 0)
    from public.deliveries d, lateral jsonb_array_elements(coalesce(d.files, '[]'::jsonb)) f
   where d.creative_id = p_creative
     and (p_exclude is null or d.id <> p_exclude)
     and d.files_purged_at is null
     and jsonb_typeof(coalesce(d.files, '[]'::jsonb)) = 'array'
$function$;
