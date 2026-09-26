-- Reviews: creative replies and up to three pinned reviews; imported reviews capped at five.
alter table public.reviews add column if not exists reply text, add column if not exists replied_at timestamptz, add column if not exists featured boolean not null default false;
alter table public.reviews drop constraint if exists reviews_reply_len;
alter table public.reviews add constraint reviews_reply_len check (reply is null or char_length(reply) <= 2000);

create or replace function public.reviews_reply_featured_guard()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if NEW.reply is distinct from OLD.reply then
    NEW.reply := nullif(btrim(NEW.reply), '');
    NEW.replied_at := case when NEW.reply is null then null else now() end;
  else
    NEW.replied_at := OLD.replied_at;
  end if;
  if NEW.featured and not coalesce(OLD.featured, false) then
    if (select count(*) from public.reviews r where r.creative_id = NEW.creative_id and r.featured and r.id <> NEW.id) >= 3 then
      raise exception 'FEATURE_LIMIT';
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists reviews_reply_featured_guard on public.reviews;
create trigger reviews_reply_featured_guard before update on public.reviews for each row execute function public.reviews_reply_featured_guard();

create or replace function public.reviews_insert_clean()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('anon','authenticated') then
    if coalesce(NEW.source,'platform') <> 'imported' then NEW.reply := null; NEW.featured := false;
    elsif (select count(*) from public.reviews r where r.creative_id = NEW.creative_id and r.source = 'imported') >= 5 then
      raise exception 'IMPORT_LIMIT';
    end if;
    NEW.reply := left(nullif(btrim(NEW.reply),''), 2000);
    NEW.replied_at := case when NEW.reply is null then null else now() end;
    if NEW.featured and (select count(*) from public.reviews r where r.creative_id = NEW.creative_id and r.featured) >= 3 then NEW.featured := false; end if;
  end if;
  return NEW;
end $$;
drop trigger if exists reviews_insert_clean on public.reviews;
create trigger reviews_insert_clean before insert on public.reviews for each row execute function public.reviews_insert_clean();
