update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif','application/pdf'] where id = 'receipts';
