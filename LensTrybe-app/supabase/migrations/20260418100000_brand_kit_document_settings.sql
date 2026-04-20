-- Per-document brand customisation (Invoice, Quote, Contract, Deliver Gallery)
alter table public.brand_kit
  add column if not exists document_brand_settings jsonb not null default '{}'::jsonb;

comment on column public.brand_kit.document_brand_settings is 'Per-tab overrides: invoice, quote, contract, deliver. Keys: logo_url, primary_color, accent_color, font, layout, custom_template_url, custom_template_name. Nulls inherit brand base.';
