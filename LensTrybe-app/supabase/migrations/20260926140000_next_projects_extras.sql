-- Projects in the new workspace: where the job is, plus the workspace's own extras (crew, gear, files, activity).
alter table public.projects add column if not exists location text, add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.projects drop constraint if exists projects_details_size;
alter table public.projects add constraint projects_details_size check (pg_column_size(details) < 65536);
-- Project tasks can have a due date.
alter table public.creative_tasks add column if not exists due_date date;
-- A note can sit with a client (thread id / email) as well as a project.
alter table public.notes add column if not exists client_ref text;
alter table public.notes drop constraint if exists notes_client_ref_len;
alter table public.notes add constraint notes_client_ref_len check (client_ref is null or char_length(client_ref) <= 320);
