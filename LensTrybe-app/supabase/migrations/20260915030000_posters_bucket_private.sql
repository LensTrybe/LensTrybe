-- Close the poster image hole.
--
-- profile_poster_public decides whether a client may see a poster: it has to be switched
-- on, the creative has to be on Expert or Elite, and today has to fall inside the dates.
-- None of that reached the image, because the posters bucket was public. An uploaded
-- file was live at a permanent URL on our domain from the moment it landed, whether or
-- not a poster was ever enabled, whatever plan the uploader was on, and it stayed there
-- after the poster was switched off or deleted.
--
-- The storage policies let any authenticated user write into their own folder in any
-- bucket, so that was every signed-up account, including free ones, with a permanent
-- public file host on lenstrybe.com.
--
-- Private now. The poster-image Edge Function asks profile_poster_public the same
-- question the profile does, and only signs a short-lived URL when the answer is yes.

update storage.buckets set public = false where id = 'posters';

-- Images are shown on profiles, so keep them to formats a browser will actually render.
-- An uploaded .html or .svg in a bucket served from our domain is a stored cross-site
-- scripting problem waiting for someone to find the direct link.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    file_size_limit = 5242880
where id = 'posters';
