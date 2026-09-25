-- LensTrybe Next: attachments in the thread.
-- Files live in the private message-attachments bucket at <creative_id>/<thread_id>/<uuid>.<ext>,
-- written and signed only by the message-attachments edge function. A message carries them in
-- messages.attachments as [{ path, name, size, type }]. The creative inserts messages directly
-- (RLS: thread participant); the client goes through portal_send_message_v2, which is
-- portal_send_message plus attachments and allows an empty body when files are attached.

update storage.buckets set public = false, file_size_limit = 52428800 where id = 'message-attachments';

create or replace function public.portal_send_message_v2(p_token uuid, p_thread_id uuid, p_body text, p_attachments jsonb default '[]'::jsonb)
returns public.messages
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_p public.client_portals;
  v_t public.message_threads;
  v_m public.messages;
  v_body text := btrim(coalesce(p_body, ''));
  v_att jsonb := coalesce(p_attachments, '[]'::jsonb);
  v_prefix text;
  a jsonb;
begin
  if jsonb_typeof(v_att) <> 'array' then raise exception 'Bad attachments'; end if;
  if jsonb_array_length(v_att) > 10 then raise exception 'Up to 10 files per message'; end if;
  if (v_body = '' and jsonb_array_length(v_att) = 0) or length(v_body) > 5000 then
    raise exception 'Message must be between 1 and 5000 characters';
  end if;
  select * into v_p from public.client_portals where portal_token = p_token;
  if not found then raise exception 'Portal not found'; end if;
  select * into v_t from public.message_threads
   where id = p_thread_id and creative_id = v_p.creative_id and lower(client_email) = lower(v_p.client_email);
  if not found then raise exception 'Conversation not found'; end if;

  -- every attachment must sit in this thread's folder, exactly as the edge function stored it
  v_prefix := v_t.creative_id::text || '/' || v_t.id::text || '/';
  for a in select * from jsonb_array_elements(v_att) loop
    if jsonb_typeof(a) <> 'object' or coalesce(a->>'path', '') not like v_prefix || '%' or position('..' in coalesce(a->>'path', '')) > 0 then
      raise exception 'Bad attachment';
    end if;
  end loop;

  insert into public.messages (creative_id, thread_id, sender_type, sender_name, sender_email, subject, body, read, attachments)
  values (v_p.creative_id, v_t.id, 'client', v_p.client_name, v_p.client_email, v_t.subject, v_body, false, v_att)
  returning * into v_m;

  begin
    insert into public.notifications (user_id, type, title, body, link, meta)
    values (v_p.creative_id, 'message',
            'New message from ' || coalesce(nullif(btrim(v_p.client_name), ''), 'your client'),
            case when v_body = '' then 'Sent ' || jsonb_array_length(v_att) || ' file' || case when jsonb_array_length(v_att) = 1 then '' else 's' end else left(v_body, 140) end,
            '/dashboard/clients/messages',
            jsonb_build_object('thread_id', v_t.id));
  exception when others then
    null;
  end;

  return v_m;
end $function$;

revoke all on function public.portal_send_message_v2(uuid, uuid, text, jsonb) from public;
grant execute on function public.portal_send_message_v2(uuid, uuid, text, jsonb) to anon, authenticated;
