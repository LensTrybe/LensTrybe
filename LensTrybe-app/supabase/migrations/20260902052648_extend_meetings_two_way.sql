alter table public.meetings
  add column if not exists meeting_type text not null default 'in_person',
  add column if not exists origin text not null default 'creative',
  add column if not exists client_phone text,
  add column if not exists requester_user_id uuid;

create index if not exists meetings_creative_idx on public.meetings(creative_id);
create index if not exists meetings_status_idx on public.meetings(status);
create index if not exists meetings_requester_idx on public.meetings(requester_user_id);
