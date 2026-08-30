# Product-grade Local Life Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade CityU Food into a deployable and operable Macau student local-life platform MVP while preserving existing data and public functionality.

**Architecture:** Add a canonical place/submission/review taxonomy beside the legacy `shops` model, migrate with an expand-and-contract strategy, and route complex writes through validated server endpoints. Postgres provides indexed search, constraints, atomic moderation functions, and RLS; the Next.js UI becomes a thin consumer of typed services.

**Tech Stack:** Next.js 15.5.24, React 19.2.8, TypeScript 5.9, Supabase/Postgres, `@supabase/supabase-js` 2.112.4, Zod 4, Vitest 4, next-intl 4, Tailwind CSS 3.

**Spec:** `docs/superpowers/specs/2026-08-29-product-grade-local-life-platform-design.md`

## Global Constraints

- Preserve the existing `shops` data and UUIDs; no destructive remote database reset.
- Keep `PLAN.md` untouched because it is a pre-existing user file.
- Keep Next.js on `15.5.24`, React on `19.2.8`, and Tailwind CSS on `3.4.x`.
- Never expose a Supabase secret/service-role key to browser code.
- Require authentication for submissions, reviews, and user media uploads.
- Treat the new canonical model as additive until migration health checks pass.
- Use TDD for every behavior change and run each focused test once red and once green.

---

### Task 1: Establish canonical taxonomy and domain contracts

**Files:**
- Create: `lib/domain/taxonomy.ts`
- Create: `lib/domain/place.ts`
- Create: `lib/domain/search.ts`
- Create: `tests/lib/domain/taxonomy.test.ts`
- Create: `tests/lib/domain/search.test.ts`
- Modify: `lib/tags/schema.ts`
- Modify: `types/shop.ts`

**Interfaces:**
- Produces: `PLACE_CATEGORIES`, `TAG_CATALOG`, `normalizeSearchText(value)`, `resolveTagAlias(query)`, `groupSelectedTags(tagIds)`.
- Produces: `Place`, `PlaceCategorySlug`, `TagKind`, `PlaceSearchRequest`, `PlaceSearchResult`.
- Consumes: existing fixed tag UUIDs so old `tag_ids` remain resolvable.

- [ ] **Step 1: Write taxonomy tests that catch divergent labels and alias failures**

```ts
expect(resolveTagAlias('漢堡').map((x) => x.slug)).toContain('burger');
expect(resolveTagAlias('burger').map((x) => x.slug)).toContain('burger');
expect(PLACE_CATEGORIES.map((x) => x.slug)).toEqual(['food', 'shopping', 'entertainment', 'service']);
expect(groupSelectedTags(['burger', 'fried-chicken']).product).toEqual(['burger', 'fried-chicken']);
```

- [ ] **Step 2: Run `npm test -- tests/lib/domain/taxonomy.test.ts` and verify RED because `lib/domain/taxonomy.ts` does not exist**
- [ ] **Step 3: Implement the four stable categories, typed tag kinds, canonical aliases, and compatibility mapping for existing UUID tags**
- [ ] **Step 4: Run the focused test and verify GREEN**
- [ ] **Step 5: Write search-contract tests for trimming, simplified/traditional normalization, duplicate tag removal, page bounds, and invalid coordinates**
- [ ] **Step 6: Run `npm test -- tests/lib/domain/search.test.ts` and verify RED**
- [ ] **Step 7: Implement `normalizePlaceSearchRequest(input: unknown): PlaceSearchRequest` with explicit defaults `page=1`, `pageSize=20`, `sort='relevance'` and maximum page size 50**
- [ ] **Step 8: Run both domain test files and verify GREEN**

### Task 2: Create reproducible Supabase baseline and additive production migration

**Files:**
- Create: `supabase/config.toml`
- Create via CLI: `supabase/migrations/20260830103144_canonical_local_life_model.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/database/canonical_schema.test.sql`
- Create: `supabase/tests/database/canonical_rls.test.sql`
- Create: `scripts/canonical-data-health.sql`
- Create: `docs/database-migration-runbook.md`

**Interfaces:**
- Produces tables: `place_categories`, `tags`, `tag_aliases`, `places`, `place_tags`, `place_submissions`, `place_media`, `reviews`, `review_media`, `search_events`.
- Produces RPCs: `search_places(...)`, `approve_place_submission(uuid, uuid, text)`, `merge_place_submission(uuid, uuid, text)`, `reject_place_submission(uuid, text)`.
- Consumes: `auth.users`, `profiles.role`, legacy `shops`, legacy `comments`, existing Storage buckets.

- [ ] **Step 1: Discover the installed CLI with `supabase --version` and `supabase migration new --help`; if absent, install the pinned Supabase CLI as a dev dependency**
- [ ] **Step 2: Run `supabase init` only when `supabase/config.toml` is absent, then create the migration with `supabase migration new canonical_local_life_model`**
- [ ] **Step 3: Write pgTAP tests first for table existence, RLS enabled, FK constraints, unique `(user_id, place_id)` active review, and public-only place reads**
- [ ] **Step 4: Run `supabase test db` or record the exact missing Docker prerequisite; tests must be RED before schema SQL is added**
- [ ] **Step 5: Implement additive tables with `uuid default gen_random_uuid()`, timestamps, status checks, ownership columns, foreign keys, and indexes on every RLS/search/filter column**
- [ ] **Step 6: Add explicit GRANT and RLS policies: guests read published places/taxonomy, members own submissions/reviews/media, admins moderate through server-verified RPCs**
- [ ] **Step 7: Add generated weighted search vector, `pg_trgm` indexes, Bayesian score columns/function, and `search_places` RPC returning `score`, `matched_by`, and `total_count`**
- [ ] **Step 8: Add idempotent legacy backfill using `shops.id` as `places.id`, normalize old tags through an explicit mapping table, and never delete legacy rows**
- [ ] **Step 9: Add seed fixtures covering food, shopping, entertainment, service, multi-tag search, sparse reviews, and duplicate nearby submissions**
- [ ] **Step 10: Run `supabase db reset`, `supabase test db`, and `scripts/canonical-data-health.sql`; verify zero orphan rows and matching backfill counts**

### Task 3: Build typed validation, API responses, and data adapters

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/api/result.ts`
- Create: `lib/api/request.ts`
- Create: `lib/auth/require-user.ts`
- Create: `lib/auth/require-admin.ts`
- Create: `lib/data/place-repository.ts`
- Create: `lib/data/submission-repository.ts`
- Create: `lib/data/review-repository.ts`
- Create: `tests/lib/api/request.test.ts`
- Create: `tests/lib/data/place-repository.test.ts`

**Interfaces:**
- Produces: `ApiResult<T>`, `parseJsonBody(request, schema)`, `requireUser(request)`, `requireAdmin(request)`.
- Produces repository boundaries that accept a Supabase client dependency and return domain types, never `Record<string, unknown>`.
- Consumes canonical database rows and RPC results from Task 2.

- [ ] **Step 1: Install an exact Zod 4 version and keep the lockfile committed**
- [ ] **Step 2: Write tests that reject malformed JSON, oversized text, unknown status values, NaN coordinates, and unauthenticated protected requests**
- [ ] **Step 3: Run focused tests and verify RED because the request/auth helpers do not exist**
- [ ] **Step 4: Implement discriminated API responses `{ok:true,data,requestId}` and `{ok:false,error:{code,message,fieldErrors?},requestId}` plus Zod request schemas**
- [ ] **Step 5: Run request tests and verify GREEN**
- [ ] **Step 6: Write adapter tests from full realistic Supabase row fixtures to `Place`, including null rating and legacy fallback**
- [ ] **Step 7: Run adapter tests and verify RED**
- [ ] **Step 8: Implement focused repositories with injected clients and explicit selected columns; remove raw-row leakage from pages touched later**
- [ ] **Step 9: Run all Task 3 tests and verify GREEN**

### Task 4: Replace client-only search with canonical ranked search

**Files:**
- Create: `app/api/places/search/route.ts`
- Create: `lib/services/search-places.ts`
- Create: `lib/search/url-state.ts`
- Create: `components/search/SearchBox.tsx`
- Create: `components/search/ActiveFilters.tsx`
- Create: `components/search/SearchResultsSummary.tsx`
- Create: `tests/lib/services/search-places.test.ts`
- Create: `tests/lib/search/url-state.test.ts`
- Modify: `app/[locale]/page.tsx`
- Modify: `components/FilterBar.tsx`
- Modify: `components/ShopList.tsx`
- Modify: `lib/search/tag-search.ts`

**Interfaces:**
- Route: `GET /api/places/search?q=&category=&tags=&region=&sort=&page=&pageSize=`.
- Produces: `searchPlaces(request, deps): Promise<PlaceSearchResponse>` and URL serialization helpers.
- Consumes: Task 1 request types and Task 3 repository.

- [ ] **Step 1: Write tests proving `汉堡`, `漢堡`, `burger`, and a place name map to relevant results with `matchedBy`, while `量子火锅飞船` returns zero results**
- [ ] **Step 2: Add tests proving product tags use OR, region/category use AND, duplicate tag IDs are ignored, and pagination total is stable**
- [ ] **Step 3: Run service tests and verify RED**
- [ ] **Step 4: Implement search service using the database RPC, with a deterministic in-memory compatibility fallback only when the RPC is unavailable; remove fixed-category unrelated fallback**
- [ ] **Step 5: Run service tests and verify GREEN**
- [ ] **Step 6: Write URL-state round-trip tests from request to query string and back**
- [ ] **Step 7: Run URL tests RED, implement helpers, then run GREEN**
- [ ] **Step 8: Integrate debounced search, suggestions grouped by place/category/tag, active-filter chips, honest empty state, result explanation, loading and retry states**
- [ ] **Step 9: Make the page read initial filters from URL and update history without losing map/list state**
- [ ] **Step 10: Remove the `tags[0]` filtering branch and verify multi-tag behavior in both desktop and mobile layouts**

### Task 5: Separate submission drafts from published places

**Files:**
- Create: `app/api/submissions/route.ts`
- Create: `app/api/submissions/[id]/route.ts`
- Create: `app/api/submissions/[id]/submit/route.ts`
- Create: `lib/domain/submission.ts`
- Create: `lib/services/submissions.ts`
- Create: `components/submission/SubmissionWizard.tsx`
- Create: `components/submission/BasicInfoStep.tsx`
- Create: `components/submission/LocationTaxonomyStep.tsx`
- Create: `components/submission/MediaConfirmStep.tsx`
- Create: `tests/lib/services/submissions.test.ts`
- Modify: `components/ContributionForm.tsx`
- Modify: `app/[locale]/my-submissions/page.tsx`

**Interfaces:**
- Produces: create/update/submit draft services; draft update uses optimistic `version` to prevent lost updates.
- Consumes: authenticated user, canonical category/tag IDs, duplicate candidates from repository, and media metadata.

- [ ] **Step 1: Write tests rejecting anonymous creation, rating fields in a place submission, invalid tag/category combinations, missing coordinates, and updates by non-owners**
- [ ] **Step 2: Write tests returning duplicate candidates within 200 meters without silently creating a place**
- [ ] **Step 3: Run submission tests and verify RED**
- [ ] **Step 4: Implement draft services and routes; no code path may insert a pending row into `shops` or `places`**
- [ ] **Step 5: Run submission tests and verify GREEN**
- [ ] **Step 6: Replace the monolithic form entry with a three-step wizard, autosave status, validation summary, duplicate confirmation, and retryable submission**
- [ ] **Step 7: Update My Submissions to read server records for the current user; retain localStorage only as a migration hint, not the source of truth**
- [ ] **Step 8: Verify refresh, back navigation, expired session, duplicate warning, and failed network retry behavior**

### Task 6: Make media lifecycle explicit and recoverable

**Files:**
- Create: `app/api/media/submission-upload/route.ts`
- Create: `app/api/media/[id]/route.ts`
- Create: `lib/services/media.ts`
- Create: `lib/storage/object-path.ts`
- Create: `tests/lib/storage/object-path.test.ts`
- Create: `tests/lib/services/media.test.ts`
- Modify: `components/ImageUpload.tsx`
- Modify: `components/AdminImageManager.tsx`

**Interfaces:**
- Produces only server-generated paths: `userId/submissionId/randomUuid.ext`.
- Delete service removes the Storage object first, then the media row; failed deletion keeps a retryable row state instead of hiding the orphan.

- [ ] **Step 1: Write path tests rejecting traversal, foreign user prefixes, executable MIME types, over-limit files, and non-image extensions**
- [ ] **Step 2: Run path tests RED, implement safe path/MIME/size validation, then run GREEN**
- [ ] **Step 3: Write media-service tests for owner upload metadata, cancel cleanup, rejection cleanup, admin delete, Storage failure, and idempotent retry**
- [ ] **Step 4: Run service tests RED, implement API-backed lifecycle, then run GREEN**
- [ ] **Step 5: Update upload components to request an authoritative parent ID before upload and never persist a naked public URL**
- [ ] **Step 6: Verify that cancelling a draft and deleting an image remove both Storage object and business record**

### Task 7: Consolidate reviews and trustworthy ranking

**Files:**
- Create: `app/api/places/[id]/reviews/route.ts`
- Create: `app/api/reviews/[id]/route.ts`
- Create: `lib/domain/review.ts`
- Create: `lib/services/reviews.ts`
- Create: `lib/ranking/confidence.ts`
- Create: `tests/lib/services/reviews.test.ts`
- Create: `tests/lib/ranking/confidence.test.ts`
- Create: `components/reviews/ReviewForm.tsx`
- Modify: `components/MobileShopDetailModal.tsx`
- Modify: `app/[locale]/shop/[id]/review/new/page.tsx`
- Modify: `scripts/review-rating-trigger.sql`

**Interfaces:**
- Produces one shared review form and create/update service used by modal and page.
- Produces `calculateConfidenceScore(average, count, globalAverage, priorWeight=5)` and `deriveTrustLabel(average, count)`.

- [ ] **Step 1: Write confidence tests proving one 5-star review is not legendary, five 4.9 reviews can qualify, null/zero reviews remain unrated, and score is monotonic with evidence**
- [ ] **Step 2: Run confidence tests RED, implement minimal ranking helpers, then run GREEN**
- [ ] **Step 3: Write review tests for auth, 1-5 integer rating, optional trimmed content, one active review per user/place, and aggregate update behavior**
- [ ] **Step 4: Run review tests RED, implement shared service/routes, then run GREEN**
- [ ] **Step 5: Replace both duplicate creation paths with `ReviewForm`; remove blank-space comments and submission-time seed ratings**
- [ ] **Step 6: Update top picks to require confidence threshold and display “评价较少” when the sample is insufficient**

### Task 8: Split moderation and make approval atomic

**Files:**
- Create: `app/api/admin/submissions/[id]/approve/route.ts`
- Create: `app/api/admin/submissions/[id]/merge/route.ts`
- Create: `app/api/admin/submissions/[id]/reject/route.ts`
- Create: `lib/services/moderation.ts`
- Create: `components/admin/SubmissionQueue.tsx`
- Create: `components/admin/PlaceManager.tsx`
- Create: `components/admin/TaxonomyManager.tsx`
- Create: `components/admin/OperationsDashboard.tsx`
- Create: `tests/lib/services/moderation.test.ts`
- Modify: `app/[locale]/admin/page.tsx`

**Interfaces:**
- Produces admin-only approve/merge/reject services calling Task 2 RPCs with request id and note.
- Consumes `requireAdmin`, submission/place repositories, and audit log.

- [ ] **Step 1: Write tests rejecting non-admins and invalid state transitions, and proving retries are idempotent**
- [ ] **Step 2: Write tests for approve-new, merge-existing, reject-with-note, media migration failure, and audit-log creation**
- [ ] **Step 3: Run moderation tests and verify RED**
- [ ] **Step 4: Implement admin routes and service; state-changing calls use atomic RPCs and never chain unrelated browser inserts**
- [ ] **Step 5: Run moderation tests and verify GREEN**
- [ ] **Step 6: Split the 1,900-line admin page into the four focused panels without changing unrelated visual styling**
- [ ] **Step 7: Add backlog, median review time, zero-result rate, missing-media count, and low-confidence-place metrics**

### Task 9: Finish navigation, localization, accessibility, and non-food discovery

**Files:**
- Modify: `messages/zh-MO.json`
- Modify: `messages/zh-CN.json`
- Modify: `messages/en.json`
- Modify: `components/Header.tsx`
- Modify: `components/ShopCard.tsx`
- Modify: `components/StarRating.tsx`
- Modify: `components/MapPlaceholder.tsx`
- Modify: `app/[locale]/shop/[id]/page.tsx`
- Create: `tests/lib/i18n/catalog.test.ts`

**Interfaces:**
- Consumes canonical categories/tags from Task 1 and search URL state from Task 4.
- Produces consistent localized labels and accessible control names.

- [ ] **Step 1: Write catalog tests proving all three locales contain the new category, submission, search, moderation, trust, empty, and error keys**
- [ ] **Step 2: Run catalog tests RED, add translations, then run GREEN**
- [ ] **Step 3: Replace hard-coded Chinese in touched flows and ensure `zh-MO` uses consistent Macau terminology**
- [ ] **Step 4: Add visible keyboard focus, button names, image alt text, semantic form errors, and keyboard-operable star rating**
- [ ] **Step 5: Verify food, shopping, entertainment, and service category browsing on mobile and desktop**

### Task 10: Production diagnostics, CI, deployment, and final verification

**Files:**
- Modify: `scripts/doctor.mjs`
- Modify: `package.json`
- Create: `.github/workflows/quality.yml`
- Create: `.env.example`
- Create: `README.md`
- Create: `docs/operations-runbook.md`
- Create: `docs/deployment-checklist.md`
- Create: `docs/rollback-runbook.md`

**Interfaces:**
- Produces repeatable Windows local setup, staging migration, Vercel deployment, monitoring, backup, and rollback procedures.
- Consumes every verification command from earlier tasks.

- [ ] **Step 1: Extend doctor to validate Node version, public environment variable names, canonical migration presence, and required non-secret configuration without printing values**
- [ ] **Step 2: Add CI jobs for `npm ci`, `npm test`, `npm run lint`, `node scripts/check-i18n.mjs`, `npm run doctor`, and `npm run build`**
- [ ] **Step 3: Document local setup and database commands with explicit `--local`/`--linked` flags; mark `db reset --linked` as forbidden for production**
- [ ] **Step 4: Document staging backup, `supabase db push --dry-run`, migration application, smoke tests, rollback, media cleanup, and incident triage**
- [ ] **Step 5: Run focused unit/integration tests, then the complete `npm test` suite and record total passing tests**
- [ ] **Step 6: Run `npm run lint`, `node scripts/check-i18n.mjs`, `npm run doctor`, and `npm run build`; read complete output and require exit code 0**
- [ ] **Step 7: When local Supabase prerequisites are available, run `supabase db reset` and `supabase test db`; otherwise report the exact unverified database boundary without claiming it passed**
- [ ] **Step 8: Review the spec acceptance criteria line by line, inspect `git diff`, confirm `PLAN.md` is unchanged, and publish the final acceptance report**
