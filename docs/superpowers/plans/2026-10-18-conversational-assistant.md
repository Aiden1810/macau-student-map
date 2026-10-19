# Conversational Assistant Implementation Plan

> Execute inline with superpowers:executing-plans. The user has directly specified the corrected chat workflow; preserve that request and continue implementation without redundant process approvals.

**Goal:** Send shop names in chat and receive actual taxi, transit and walking comparisons.
**Architecture:** Existing DeepSeek/Zod and anonymous published-place reads extract intent and resolve names; client chat orchestrates confirmed AMap lookups and factual output. Reuse existing provider and recommendation rules.
**Tech Stack:** Existing Next.js, React, TypeScript, AI SDK, AMap JS SDK; no new dependencies.
**Spec:** docs/superpowers/specs/2026-10-18-conversational-assistant-design.md

## Constraints
No DB writes, no deployment, no Key changes. At most four destinations, six user questions, 20KB body. Exact location stays with AMap. Preserve three locales, per-mode failures and explicit branch confirmation.

## Tasks
- [x] 1. Add tests and implement walking route support, navigation mode, optional legacy snapshot compatibility and walking preference in the domain contracts/decision/answer.
- [x] 2. Add tests and implement chat extraction schema/model adapter, published-name matching and API factory. Reuse existing configuration, throttling and authoritative published-place reader.
- [x] 3. Replace the form-driven assistant page with focused chat components, origin/branch confirmations inside replies, stop/reset semantics and three-mode route cards. Keep empty-state examples and accessible keyboard input.
- [x] 4. Run focused/full tests, lint, TypeScript, production build; verify real browser chat → name matching → origin confirmation → three route modes, and live budget follow-up. Record screenshots/setup changes and review.

## Review focus
No first-result guessing for branches or POIs; no hidden writes for repaired coordinates. Cancel/reset must discard late work. Context must retain explicit selections on budget-only follow-up, and replace destinations on explicit name changes. Walking distance is route length, not straight-line distance. No precise origin coordinates or browser Key leaks to the model/client.

## Ledger
Ruling: continue in the existing owned codex/admin-place-workflow checkout; previous feature changes and local configuration are needed here. Do not copy or reset them into another checkout.

Task 1–4 complete: 50 test files / 300 tests passed; lint, TypeScript and production build passed. Three locales HTTP 200 with chat composer and no selection form. Static JS scan found no server DeepSeek configuration.

Fresh read-only review plus fix recheck passed. Regressions cover explicit current-origin replacement, same-name confirmed branch IDs with fresh facts, missing-coordinate dining eligibility and conservative POI identity/address linkage. Map candidates keep unique POI IDs/addresses; catalog linking requires exact full name/address (at least 8 normalized address characters). Conversation-only confirmed coordinates merge only when fresh catalog address is unchanged.

Real browser test with existing Key: directly typed Poly origin + 二师兄/穆味王; confirmed origin inside reply; returned actual taxi/transit/walking minutes and metres. Follow-ups for 4 people/CNY40 and 2 people/CNY30 retained names, origin and noodles; totals 112/56. Explicit current-origin replacement waited for the location action rather than reusing old origin. New conversation during a live request cleared the thread. Desktop and 390px mobile layouts checked; viewport override reset afterwards. Physical geolocation was not triggered during testing.

Evidence: output/assistant-verification/chat-empty.png, chat-routes-desktop.png, chat-mobile.png. No DB mutation, Key change, dependency addition or deployment.
