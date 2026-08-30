begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

select has_table('public', 'place_categories', 'place_categories exists');
select has_table('public', 'tags', 'tags exists');
select has_table('public', 'tag_aliases', 'tag_aliases exists');
select has_table('public', 'places', 'places exists');
select has_table('public', 'place_tags', 'place_tags exists');
select has_table('public', 'place_submissions', 'place_submissions exists');
select has_table('public', 'place_media', 'place_media exists');
select has_table('public', 'reviews', 'reviews exists');
select has_table('public', 'review_media', 'review_media exists');
select has_table('public', 'search_events', 'search_events exists');

select col_is_pk('public', 'places', 'id', 'places.id is the primary key');
select col_is_pk('public', 'place_submissions', 'id', 'place_submissions.id is the primary key');
select col_is_pk('public', 'reviews', 'id', 'reviews.id is the primary key');

select has_column('public', 'places', 'search_document', 'places has generated search document');
select has_column('public', 'places', 'confidence_score', 'places stores confidence score');
select has_column('public', 'place_submissions', 'version', 'submissions support optimistic concurrency');
select has_column('public', 'place_media', 'storage_path', 'place media stores object path');
select has_column('public', 'review_media', 'storage_path', 'review media stores object path');

select fk_ok('public', 'place_tags', 'place_id', 'public', 'places', 'id', 'place_tags references places');
select fk_ok('public', 'place_tags', 'tag_id', 'public', 'tags', 'id', 'place_tags references tags');
select fk_ok('public', 'reviews', 'place_id', 'public', 'places', 'id', 'reviews references places');
select fk_ok('public', 'reviews', 'user_id', 'auth', 'users', 'id', 'reviews references auth users');
select fk_ok('public', 'place_submissions', 'submitted_by', 'auth', 'users', 'id', 'submissions reference auth users');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.places'::regclass),
  'RLS is enabled on places'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.place_submissions'::regclass),
  'RLS is enabled on place_submissions'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.reviews'::regclass),
  'RLS is enabled on reviews'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.place_media'::regclass),
  'RLS is enabled on place_media'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.review_media'::regclass),
  'RLS is enabled on review_media'
);

select has_function('public', 'search_places', 'search_places RPC exists');
select has_function('public', 'approve_place_submission', 'approve RPC exists');
select has_function('public', 'merge_place_submission', 'merge RPC exists');
select has_function('public', 'reject_place_submission', 'reject RPC exists');

select has_index('public', 'places', 'places_search_document_idx', 'search document has a GIN index');
select has_index('public', 'places', 'places_name_trgm_idx', 'place names have a trigram index');
select has_index('public', 'place_submissions', 'place_submissions_submitted_by_idx', 'submission ownership is indexed');

select * from finish();
rollback;
