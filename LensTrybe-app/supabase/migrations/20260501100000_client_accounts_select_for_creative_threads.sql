-- Allow creatives to read client_accounts rows for clients they have a message thread with
-- (so dashboard Messages can show name instead of email).

drop policy if exists "client_accounts_select_for_creative_conversation" on public.client_accounts;
create policy "client_accounts_select_for_creative_conversation"
  on public.client_accounts for select
  to authenticated
  using (
    exists (
      select 1
      from public.message_threads mt
      where mt.client_user_id = client_accounts.id
        and mt.creative_id = auth.uid()
    )
  );
