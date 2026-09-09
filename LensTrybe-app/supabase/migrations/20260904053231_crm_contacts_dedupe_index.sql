-- One CRM contact per creative per email, so lead auto-capture can upsert
-- instead of creating duplicates. Case-insensitive on email; ignores blank emails.
create unique index if not exists crm_contacts_creative_lower_email_uniq
  on crm_contacts (creative_id, lower(email))
  where email is not null and email <> '';
