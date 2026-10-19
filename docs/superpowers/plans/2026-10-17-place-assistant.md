# Place Assistant Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline. The user explicitly requested direct implementation of the agreed two workflows and will supply the API Key afterwards.

**Goal:** Deliver selected-place taxi/transit comparison and conversational evidence-based dining recommendations.
**Architecture:** Existing public place data + AMap JS SDK routes + a server-only DeepSeek intent adapter; deterministic decisions and factual output.
**Tech Stack:** Existing Next.js/React/TypeScript/Zod/Supabase, AI SDK + DeepSeek provider.
**Spec:** docs/superpowers/specs/2026-10-17-place-assistant-design.md

## Constraints
- No place-data edits, no guessed coordinates, no fake route times or model facts, no API Key in browser bundles.
- At most four selected published places; bounded request/history sizes and timeouts; partial route failures remain visible.
- Main product code stays in current structure. New third-party packages pinned in package/lock files.

## Tasks
- [x] 1. Tests then domain contracts and deterministic comparison: lib/assistant/contracts.ts, decision.ts; tests/lib/assistant/decision.test.ts.
- [x] 2. Tests then shared SDK loading and route adapter: lib/amap/place-search.ts, lib/amap/route-comparison.ts; tests/lib/amap/route-comparison.test.ts. Reuse existing loader; support independently failed modes, deadline, city configuration and no fabricated location.
- [x] 3. Tests then DeepSeek server adapter and API factory: lib/assistant/model.ts, lib/api/place-assistant-route.ts, app/api/assistant/route.ts; tests/lib/api/place-assistant-route.test.ts. Read authoritative published rows, validate route snapshots, bound costs and report configuration/error states.
- [x] 4. Implement assistant page and focused UI pieces: app/[locale]/assistant/page.tsx, components/assistant/*, lib/assistant/copy.ts; add Header entry and optional initial query to existing POI selector if needed.
- [x] 5. Document Key setup and acceptance examples in docs/place-assistant-setup.md and .env.example. Complete focused tests, full test, lint, TypeScript, build, and available real-provider map checks. Record any unmet live-Key verification explicitly.

## Validation recorded 2026-10-18
- 46 test files / 280 tests passed; ESLint, TypeScript and production build passed.
- AMap JS product adapter returned real taxi and transit results; browser test confirmed published candidates, POI origin selection, independent route failures, mode-specific navigation URLs and unconfigured AI response.
- DeepSeek HTTP contract tested using mock responses; the user's corrected Key then passed official authentication and two real browser model requests (initial recommendation and follow-up changing group size/budget). No place-data writes or deployment performed.
- Read-only code review and fix recheck passed; regression tests cover concrete cuisine aliases, unknown/conflicting destination cities, and non-food recommendation exclusion.

## Review focus
- Changing selection/origin while requests run must discard old replies/routes.
- Expired routes, failed transit, missing prices and coordinates never become confident claims.
- Budget-only follow-ups preserve previous food/group preferences; reset is explicit.
- Cross-border route failure or omitted border time is clearly stated, not estimated by the model.
- Same-name places must remain separate by id and address; no auto-matching ambiguous branches.
