alter table portfolio_items
  add column if not exists headline text,
  add column if not exists alt_text text;

-- Backfill headline from legacy title where missing
update portfolio_items
set headline = title
where coalesce(nullif(trim(headline), ''), null) is null
  and coalesce(nullif(trim(title), ''), null) is not null;
