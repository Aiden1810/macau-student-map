# Security Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Patch the project's production dependency vulnerabilities and protect the administrator-only missed-query analytics route.

**Architecture:** The admin client will attach its current Supabase access token to the same-origin analytics request. The route will validate the token and the caller's profile role before querying. A matching RLS policy will make analytics reads available only to administrators.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Supabase, Postgres RLS.

**Spec:** `docs/superpowers/specs/2026-08-29-security-maintenance-design.md`

## Global Constraints

- Keep Next.js on `15.5.24`; do not migrate to Next.js 16.
- Do not add a service-role key, credentials, or `.env.local` values to source control.
- Do not execute SQL against the live Supabase project or deploy to Vercel.
- Treat `rating = null` as the canonical no-review value and keep `rating_label = '暂无评分'` in sync.

---

### Task 1: Add focused admin-request tests and helpers

**Files:**
- Create: `lib/admin/request-auth.ts`
- Create: `tests/lib/admin/request-auth.test.ts`
- Modify: `package.json`

- [x] Add Vitest and the `test` script.
- [x] Write tests that accept a trimmed bearer token and reject missing, blank, or malformed authorization headers.
- [x] Run the test and confirm it fails because the helper does not exist.
- [x] Implement `readBearerToken(request: Request): string | null` and `isAdminRole(role: unknown): boolean`.
- [x] Re-run the test and confirm it passes.

### Task 2: Protect missed-query analytics

**Files:**
- Modify: `app/api/admin/missed-query-ops/route.ts`
- Modify: `app/[locale]/admin/page.tsx`
- Create: `scripts/add-search-query-log-admin-policy.sql`

- [x] Read the current Supabase session before the client fetch and send its access token in the Authorization header.
- [x] Return `401` when the route has no valid bearer token and `403` when the token owner is not an administrator.
- [x] Query `profiles.role` before reading analytics rows.
- [x] Add an idempotent SQL policy that enables RLS and permits only administrators to select `search_query_log`.
- [x] Run TypeScript/build validation.

### Task 3: Correct maintenance and consistency files

**Files:**
- Modify: `scripts/doctor.mjs`
- Modify: `.gitignore`
- Modify: `components/ContributionForm.tsx`
- Modify: `app/[locale]/admin/page.tsx`
- Modify: `scripts/review-rating-trigger.sql`

- [x] Replace Mapbox checks with AMap configuration checks.
- [x] Normalize `.gitignore` as UTF-8 with one rule per line.
- [x] Remove the unused import and make the tag-category map stable for hook dependencies.
- [x] Make the rating trigger update `rating_label` and preserve `null` for shops with no reviews.
- [x] Run doctor, lint, and the i18n check.

### Task 4: Apply compatible security upgrades and verify

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] Install the patched compatible dependencies: Next 15.5.24, next-intl 4.14.1, PostCSS 8.5.26, React 19.2.8, Supabase 2.112.4, and related patch tooling.
- [x] Run `npm audit --omit=dev --json` and record remaining upstream-only advisories, if any.
- [x] Run `npm test`, `npm run doctor`, `npm run lint`, `node scripts/check-i18n.mjs`, and `npm run build`.
