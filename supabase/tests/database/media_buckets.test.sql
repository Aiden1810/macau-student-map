begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select ok(
  exists(select 1 from storage.buckets where id = 'submission-media'),
  'private submission media bucket exists'
);
select ok(
  exists(select 1 from storage.buckets where id = 'place-media'),
  'public place media bucket exists'
);
select is(
  (select public from storage.buckets where id = 'submission-media'),
  false,
  'submission media bucket is private'
);
select is(
  (select public from storage.buckets where id = 'place-media'),
  true,
  'place media bucket is public'
);
select is(
  (select file_size_limit from storage.buckets where id = 'submission-media'),
  10485760::bigint,
  'submission media files are limited to 10 MiB'
);
select is(
  (select file_size_limit from storage.buckets where id = 'place-media'),
  10485760::bigint,
  'place media files are limited to 10 MiB'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'submission-media'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'submission media only accepts supported image types'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'place-media'),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'place media only accepts supported image types'
);

select * from finish();
rollback;
