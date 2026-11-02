# Marine Buy: project rules (read before changing anything)

Sailing-jacket research and comparison site. Stack: static front end (public/) + small Express API (server/) + JSON data (data/). No accounts, checkout, used listings or chatbot.

## Honesty rules (never break)
- Never invent sources, quotes, review counts, video IDs, prices, ratings or product claims. If unverified: price reads "Check price at retailer", specs read "Not provided", empty states stay honest.
- Never reset a "chk" (last checked) date to today automatically. Only set it when a price/source was actually read on that date.
- Do not infer verified ownership from a forum or Reddit post. One post is not consensus. Summarise sources in our own words; short quotes only.
- Label every source Exact model or RELATED MODEL (earlier version). Brand-hosted star ratings are shown but never scored.
- Image rights stay "unconfirmed" unless there is written permission or approved feed terms. Show "Product photo unavailable" + retailer link when there is no photo. No AI-generated jackets.
- Do not claim complete market coverage.

## Where things live
- data/products.json, offers.json, sources.json, images.json, videos.json: curated content (kept separate on purpose).
- data/scoring.json: waterproof figures (WP) and our 1-5 readings per source (TONE). public/js/score.js: the formula. docs/rating-system.md: the method. Keep all three in step.
- public/js/app.js: UI and routing (hash URLs keep filters and comparison). public/css/styles.css: design tokens at the top.
- public/js/accounts.js: device-local profiles and onboarding; public/js/profile-hub.js: Profile Hub; public/js/gear.js: My gear (user-entered, per profile, browser only). Fit notes in My gear are personal records, never reviews or evidence.
- public/images/site/: lifestyle artwork only (not product photos); provenance and rights in docs/site-art.md.
- server/index.js: API. server/validate.js: data checks.
- data/fit-evidence.json, data/size-charts.json: fit evidence and official size charts (server-side context for the AI assistant).
- server/assistant.js: retained Gemini endpoint (POST /api/research-chat), SYSTEM_INSTRUCTION, allowlist validation. The public frontend currently uses rules-based guidance only; do not reconnect Gemini without an explicit request and a separately hosted backend. GEMINI_API_KEY stays server-side in .env (never commit, never log, never send to the browser). Keep model output plain text; links only from stored records; only allowlisted UI actions.

## Workflow
1. Edit data or code. 2. `npm run validate`. 3. `npm run dev`, open http://localhost:3000 and check desktop + a 375px-wide window. 4. Report what was and was not verified.
