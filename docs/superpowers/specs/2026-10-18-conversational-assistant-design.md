# Conversational place assistant

User correction: the entry point must be a normal chat, like a web AI messenger. Users type shop names and ask how long taxi, public transit and walking take from their origin. They must not first complete a candidate-selection form. Keep existing dining recommendations and budget/group follow-ups.

## Interaction and visual direction
Warm off-white chat canvas, restrained green identity, narrow desktop sidebar with new conversation/map links, central message thread, bottom composer. Empty state offers example questions that populate the composer. User messages sit right; assistant messages contain prose, branch-confirmation buttons and real route cards. No fake uploads, voice controls, stored chat history or unsolicited product features.

## Flow
One bounded DeepSeek structured call extracts destination names, origin action/query and existing dining intent from the last six user messages plus confirmed context. A server read loads published places; deterministic matching preserves branch names and distinguishes exact, ambiguous and absent matches. Unlisted shops or missing coordinates can be looked up through the existing AMap POI SDK; the user confirms the specific result. Never silently choose the first map result.

For “from here,” ask for an explicit location action or a searched origin. Browser location runs only after the user clicks it. Explicit origins typed in chat are searched and confirmed inside the assistant reply. Once the necessary confirmations exist, AMap Driving/Transfer/Walking query actual route time and length. Responses show minutes, metres/kilometres, transit lines and mode-specific navigation; failures stay per-mode. Chat follow-ups reuse confirmed places and origin. New conversation and cancellation invalidate asynchronous work.

## Boundaries
At most four destinations. No DB writes, new dependencies, deployment or Key changes. API Key remains server-only; no precise origin coordinates sent to DeepSeek. Published prices/categories come from the server; external POIs have unknown price/category and cannot become evidence for a dining recommendation. Recommendation rules and response facts remain deterministic; this user's browser assembles them from server-loaded facts and provider route results. Existing legacy API is retained for compatibility. The new chat endpoint performs recognition only, one paid call per message. No claim of taxi waiting/border time or universal cross-border coverage.

## Acceptance
Type multiple real names and an origin in a single message; confirm ambiguous places in the reply; receive all three travel modes with real distances. A vague current origin triggers a location request, not invented coordinates. Two same-brand branches cannot silently collapse. Budget/group follow-ups still work. Missing model, map service or routes produce recoverable chat messages. Test cancellation, reset and IME Enter handling. Keep all three locales.
