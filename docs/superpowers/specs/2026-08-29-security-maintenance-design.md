# Security Maintenance Design

## Goal

Upgrade the production project's security patches and correct the maintenance paths that are currently misleading or unsafe, without changing the public product flow or modifying the live Supabase project.

## Scope

- Upgrade compatible patch and minor versions for Next.js 15, next-intl, PostCSS, React, Supabase, and their type/tooling packages.
- Require an authenticated administrator before the missed-search-query operations endpoint returns analytics data.
- Keep the admin page's existing UI, but attach the current Supabase access token to its request.
- Add a SQL script that documents the required RLS policy for administrator reads of `search_query_log`.
- Update the project doctor script from the removed Mapbox stack to the current AMap stack.
- Normalize `.gitignore` and remove current lint warnings.

## Non-Goals

- Do not upgrade to Next.js 16, Tailwind CSS 4, TypeScript 7, ESLint 10, or lucide-react 1 because these are major migrations.
- Do not use administrator credentials, access the Supabase dashboard, execute SQL against production, or deploy to Vercel.
- Do not redesign the admin UI or alter the public submission flow.

## Architecture

The browser keeps its existing Supabase session. The admin page obtains the session access token and sends it only to the same-origin `/api/admin/missed-query-ops` route using an `Authorization: Bearer` header. The route verifies the token with Supabase Auth, checks the caller's `profiles.role` field, and uses that authenticated client for the analytics query. Requests without an authenticated administrator receive `401` or `403` and no analytics data.

The SQL policy is kept as a new, explicit script because the repository does not yet have a versioned Supabase migration directory. It grants `search_query_log` reads only to users whose matching profile has `role = 'admin'`; it does not grant anonymous access.

## Acceptance Criteria

- `npm audit --omit=dev` no longer reports vulnerabilities caused by the patched direct dependencies, subject to upstream transitive packages.
- `npm run doctor`, `npm run lint`, `node scripts/check-i18n.mjs`, and `npm run build` exit successfully with no warnings introduced by this maintenance pass.
- The missed-query route rejects requests without a bearer token and rejects authenticated non-admin users.
- The admin page sends the current session token before requesting the operations data.
- No secret, service-role key, or administrator credential is added to source control.
