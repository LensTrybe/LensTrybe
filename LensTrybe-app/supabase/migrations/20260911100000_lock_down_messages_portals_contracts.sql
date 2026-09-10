-- Messaging, client portal and contract-signing lockdown.
--
-- Before this migration:
--   * any signed-in user could read, edit and delete every message (policy USING true)
--   * anyone (not signed in) could read every message, thread, client portal
--     (including portal tokens), invoice, quote and contract
--   * anyone could read or "sign" any contract that had a signing token
--
-- After:
--   * threads and messages are visible only to the two participants
--     (thread.creative_id and thread.client_user_id)
--   * token pages (client portal, contract signing) and public website enquiries go
--     through SECURITY DEFINER functions that check the token and return only that
--     client's data
--   * waitlist and creator-partner applications are admin-only to read

-- ---------------------------------------------------------------- helpers
create or replace function public.is_thread_participant(p_thread uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.message_threads t
     where t.id = p_thread
       and (t.creative_id = auth.uid() or t.client_user_id = auth.uid())
  )
$$;

-- messages.creative_id always mirrors the thread owner (some clients left it null
-- or set it to the sender).
create or replace function public.messages_set_creative_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.thread_id is not null then
    select t.creative_id into NEW.creative_id from public.message_threads t where t.id = NEW.thread_id;
  end if;
  return NEW;
end $$;

drop trigger if exists a_messages_set_creative_id on public.messages;
create trigger a_messages_set_creative_id
  before insert on public.messages
  for each row execute function public.messages_set_creative_id();

-- ---------------------------------------------------------------- message_threads
drop policy if exists "Anon can create message threads" on public.message_threads;
drop policy if exists "Anon can read message threads for portal" on public.message_threads;
drop policy if exists "Anyone can insert a thread" on public.message_threads;
drop policy if exists "Clients can create threads" on public.message_threads;
drop policy if exists "Clients can view own threads" on public.message_threads;
drop policy if exists "Clients can view their own threads" on public.message_threads;
drop policy if exists "Creatives can manage their threads" on public.message_threads;
drop policy if exists "Creatives can view their own threads" on public.message_threads;
drop policy if exists "Public can view message threads for portal" on public.message_threads;

create policy threads_select_participants on public.message_threads
  for select to authenticated
  using (creative_id = auth.uid() or client_user_id = auth.uid());
create policy threads_insert_participants on public.message_threads
  for insert to authenticated
  with check (creative_id = auth.uid() or client_user_id = auth.uid());
create policy threads_update_participants on public.message_threads
  for update to authenticated
  using (creative_id = auth.uid() or client_user_id = auth.uid())
  with check (creative_id = auth.uid() or client_user_id = auth.uid());
create policy threads_delete_participants on public.message_threads
  for delete to authenticated
  using (creative_id = auth.uid() or client_user_id = auth.uid());

-- ---------------------------------------------------------------- messages
drop policy if exists "Anon can insert messages" on public.messages;
drop policy if exists "Anon can read messages by thread" on public.messages;
drop policy if exists "Creatives can manage their messages" on public.messages;
drop policy if exists "Public can insert messages for portal" on public.messages;
drop policy if exists "Public can view messages for portal" on public.messages;
drop policy if exists "Thread participants can view messages" on public.messages;
drop policy if exists "Users can manage their own messages" on public.messages;

create policy messages_select_participants on public.messages
  for select to authenticated
  using (creative_id = auth.uid() or public.is_thread_participant(thread_id));
create policy messages_insert_participants on public.messages
  for insert to authenticated
  with check (public.is_thread_participant(thread_id));
create policy messages_update_participants on public.messages
  for update to authenticated
  using (creative_id = auth.uid() or public.is_thread_participant(thread_id))
  with check (creative_id = auth.uid() or public.is_thread_participant(thread_id));
create policy messages_delete_participants on public.messages
  for delete to authenticated
  using (creative_id = auth.uid() or public.is_thread_participant(thread_id));

-- ---------------------------------------------------------------- client_portals
drop policy if exists "Anon can create client portals" on public.client_portals;
drop policy if exists "Anon can read portal by token" on public.client_portals;
drop policy if exists "Public can view portals by token" on public.client_portals;
-- "Creatives can manage their own portals" (creative_id = auth.uid()) remains.

-- ---------------------------------------------------------------- invoices / quotes / contracts
drop policy if exists "Anon can read invoices for portal" on public.invoices;
drop policy if exists "Public can view invoices by client email" on public.invoices;
drop policy if exists "Anon can read quotes for portal" on public.quotes;
drop policy if exists "Public can view quotes by client email" on public.quotes;
drop policy if exists "Anon can read contracts for portal" on public.contracts;
drop policy if exists "Public can view contracts by client email" on public.contracts;
drop policy if exists "Public can view contract by signing token" on public.contracts;
drop policy if exists "Public can sign contract by signing token" on public.contracts;

-- ---------------------------------------------------------------- admin-only lists
drop policy if exists "Admin can read waitlist" on public.waitlist;
create policy "Admin can read waitlist" on public.waitlist
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
drop policy if exists "Admin can read applications" on public.creator_partner_applications;
create policy "Admin can read applications" on public.creator_partner_applications
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- ---------------------------------------------------------------- client portal (token)
create or replace function public.portal_load(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v public.client_portals;
begin
  select * into v from public.client_portals where portal_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'portal', jsonb_build_object('id', v.id, 'creative_id', v.creative_id, 'client_name', v.client_name,
                                 'client_email', v.client_email, 'created_at', v.created_at),
    'creative', (select jsonb_build_object('business_name', p.business_name, 'avatar_url', p.avatar_url,
                                           'location', p.location, 'subscription_tier', p.subscription_tier)
                   from public.profiles p where p.id = v.creative_id),
    'invoices', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from public.invoices i
                           where i.creative_id = v.creative_id and lower(i.client_email) = lower(v.client_email)
                             and coalesce(lower(i.status), '') <> 'draft'), '[]'::jsonb),
    'quotes', coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from public.quotes q
                         where q.creative_id = v.creative_id and lower(q.client_email) = lower(v.client_email)
                           and coalesce(lower(q.status), '') <> 'draft'), '[]'::jsonb),
    'contracts', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.contracts c
                            where c.creative_id = v.creative_id and lower(c.client_email) = lower(v.client_email)
                              and coalesce(lower(c.status), '') <> 'draft'), '[]'::jsonb),
    'threads', coalesce((select jsonb_agg(to_jsonb(t) order by t.last_message_at desc nulls last) from public.message_threads t
                          where t.creative_id = v.creative_id and lower(t.client_email) = lower(v.client_email)), '[]'::jsonb)
  );
end $$;

create or replace function public.portal_thread_messages(p_token uuid, p_thread_id uuid)
returns setof public.messages language sql stable security definer set search_path = public as $$
  select m.*
    from public.messages m
    join public.message_threads t on t.id = m.thread_id
    join public.client_portals p on p.creative_id = t.creative_id and lower(p.client_email) = lower(t.client_email)
   where p.portal_token = p_token and t.id = p_thread_id
   order by m.created_at asc
$$;

create or replace function public.portal_send_message(p_token uuid, p_thread_id uuid, p_body text)
returns public.messages language plpgsql security definer set search_path = public as $$
declare
  v_p public.client_portals;
  v_t public.message_threads;
  v_m public.messages;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_body = '' or length(v_body) > 5000 then
    raise exception 'Message must be between 1 and 5000 characters';
  end if;
  select * into v_p from public.client_portals where portal_token = p_token;
  if not found then raise exception 'Portal not found'; end if;
  select * into v_t from public.message_threads
   where id = p_thread_id and creative_id = v_p.creative_id and lower(client_email) = lower(v_p.client_email);
  if not found then raise exception 'Conversation not found'; end if;
  insert into public.messages (creative_id, thread_id, sender_type, sender_name, sender_email, subject, body, read)
  values (v_p.creative_id, v_t.id, 'client', v_p.client_name, v_p.client_email, v_t.subject, v_body, false)
  returning * into v_m;
  update public.message_threads
     set last_message_at = now(), unread_count = coalesce(unread_count, 0) + 1
   where id = v_t.id;
  return v_m;
end $$;

-- ---------------------------------------------------------------- public website enquiry
create or replace function public.submit_website_enquiry(
  p_creative_id uuid, p_name text, p_email text, p_message text,
  p_subject text default 'Enquiry from portfolio website')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_msg text := btrim(coalesce(p_message, ''));
  v_subject text := left(coalesce(nullif(btrim(p_subject), ''), 'Enquiry from portfolio website'), 200);
  v_thread uuid;
begin
  if v_name = '' or length(v_name) > 200 then raise exception 'Please enter your name'; end if;
  if length(v_email) > 320 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Please enter a valid email address';
  end if;
  if v_msg = '' or length(v_msg) > 5000 then raise exception 'Message must be between 1 and 5000 characters'; end if;
  if not exists (select 1 from public.profiles where id = p_creative_id) then
    raise exception 'Creative not found';
  end if;

  insert into public.message_threads (creative_id, client_user_id, client_name, client_email, subject, last_message_at, unread_count)
  values (p_creative_id, auth.uid(), v_name, v_email, v_subject, now(), 1)
  returning id into v_thread;

  insert into public.messages (creative_id, thread_id, sender_type, sender_name, sender_email, subject, body, read)
  values (p_creative_id, v_thread, 'client', v_name, v_email, v_subject, v_msg, false);

  return v_thread;
end $$;

-- ---------------------------------------------------------------- client account linking
-- Links enquiry threads sent from this person's (confirmed) email to their account.
create or replace function public.link_my_client_threads()
returns integer language plpgsql security definer set search_path = public as $$
declare v_email text; v_n integer;
begin
  if auth.uid() is null then return 0; end if;
  select email into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  update public.message_threads
     set client_user_id = auth.uid()
   where client_user_id is null and lower(client_email) = lower(v_email);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------- contract signing (token)
create or replace function public.contract_for_signing(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('contract', to_jsonb(c), 'business_name', p.business_name)
    from public.contracts c
    left join public.profiles p on p.id = c.creative_id
   where c.signing_token = p_token
$$;

create or replace function public.sign_contract(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.contracts;
begin
  select * into v from public.contracts where signing_token = p_token;
  if not found then raise exception 'Contract not found'; end if;
  if coalesce(lower(v.status), '') <> 'signed' then
    update public.contracts set status = 'signed', signed_at = now() where id = v.id returning * into v;
  end if;
  return jsonb_build_object('id', v.id, 'status', v.status, 'signed_at', v.signed_at);
end $$;

-- ---------------------------------------------------------------- grants
revoke execute on function public.is_thread_participant(uuid) from public, anon;
grant execute on function public.is_thread_participant(uuid) to authenticated;
revoke execute on function public.messages_set_creative_id() from public, anon, authenticated;
revoke execute on function public.link_my_client_threads() from public, anon;
grant execute on function public.link_my_client_threads() to authenticated;
revoke execute on function public.portal_load(uuid) from public;
revoke execute on function public.portal_thread_messages(uuid, uuid) from public;
revoke execute on function public.portal_send_message(uuid, uuid, text) from public;
revoke execute on function public.submit_website_enquiry(uuid, text, text, text, text) from public;
revoke execute on function public.contract_for_signing(uuid) from public;
revoke execute on function public.sign_contract(uuid) from public;
grant execute on function public.portal_load(uuid) to anon, authenticated;
grant execute on function public.portal_thread_messages(uuid, uuid) to anon, authenticated;
grant execute on function public.portal_send_message(uuid, uuid, text) to anon, authenticated;
grant execute on function public.submit_website_enquiry(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.contract_for_signing(uuid) to anon, authenticated;
grant execute on function public.sign_contract(uuid) to anon, authenticated;
