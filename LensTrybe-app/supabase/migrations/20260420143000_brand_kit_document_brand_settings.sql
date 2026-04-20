-- Per-document brand JSON on brand_kit (invoice, quote, contract, deliver_gallery)
alter table public.brand_kit
  add column if not exists document_brand_settings jsonb not null default '{}'::jsonb;

comment on column public.brand_kit.document_brand_settings is 'Per-document overrides: invoice, quote, contract, deliver_gallery. Fields: logo, primary_colour, accent_colour, font, selected_template; optional custom_template_url/name.';
