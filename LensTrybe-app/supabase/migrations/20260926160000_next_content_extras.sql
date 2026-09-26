alter table public.content_ideas add column if not exists why text, add column if not exists kind text;
update storage.buckets set file_size_limit = 104857600, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif','video/mp4','video/quicktime','video/webm'] where id = 'content-media';
