-- Invoices and quotes were emailed as a PDF attachment, which meant every send depended
-- on PDFShift and told the creative nothing about whether the client ever opened it.
--
-- A view token turns each document into its own private link. The branded document is
-- already rendered server side by the document-pdf function, so the link reuses that
-- exact HTML: nothing about the look changes, and the PDF becomes something the client
-- chooses to print rather than something we pay a service to generate on every send.

alter table public.invoices
  add column if not exists view_token uuid not null default gen_random_uuid();
alter table public.quotes
  add column if not exists view_token uuid not null default gen_random_uuid();

create unique index if not exists invoices_view_token_idx on public.invoices (view_token);
create unique index if not exists quotes_view_token_idx on public.quotes (view_token);

comment on column public.invoices.view_token is
  'Unguessable key for the public document link at /doc/invoice/<token>. Not a login: it grants read-only access to this one document.';
comment on column public.quotes.view_token is
  'Unguessable key for the public document link at /doc/quote/<token>. Not a login: it grants read-only access to this one document.';
