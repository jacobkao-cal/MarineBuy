# Marine Buy

Sailing-jacket research and comparison site: search, filters, product pages, private Likes (My Likes), 2–4 product comparison, source-backed feedback posts, and the Marine Buy Score.
Status: prototype with 5 jackets (see "Known gaps"). Last data check: 2026-10-15.

## 1. Open it in VS Code (first time)
1. Install **Node.js 18+** from nodejs.org (the "LTS" button). Install **VS Code** if needed.
2. Unzip this folder. In VS Code: **File → Open Folder…** and choose `marine-buy`. Click "Yes, I trust the authors".
3. Accept the pop-up to install recommended extensions (Claude Code, Prettier).
4. Open the terminal: **Terminal → New Terminal**, then run:
   ```
   npm install
   npm run dev
   ```
5. Visit **http://localhost:3000** in your browser. Stop the server with Ctrl+C.

Shortcuts: **Ctrl+Shift+B** (Cmd+Shift+B on Mac) runs the dev server. **Terminal → Run Task → Validate data** checks your data. **F5** debugs the server.

## 2. Project map (your control board)
| What | File |
|---|---|
| Products, specs, intended use | `data/products.json` |
| Retailer links, prices, last-checked dates | `data/offers.json` |
| Reviews, forum posts, editorial sources | `data/sources.json` |
| Photos (one record per photo, gallery order) | `data/images.json` + `public/images/<brand>/` |
| YouTube reviews (empty until verified) | `data/videos.json` |
| Score inputs (waterproof mm, our 1–5 readings) | `data/scoring.json` |
| Score formula | `public/js/score.js` |
| Pages, filters, My Likes, compare, URLs | `public/js/app.js` |
| Research workspace UI | `public/js/workspace.js` |
| Priority definitions and recommendation rules | `public/js/research.js` |
| Notes, priorities and view settings | `public/js/workspace-state.js` |
| Likes storage (localStorage, browser only) | `public/js/likes.js` |
| Fit evidence (one fit point per record, linked to its source) | `data/fit-evidence.json` |
| Official size charts (none recorded yet) | `data/size-charts.json` |
| AI assistant endpoint, prompt rules, output checks | `server/assistant.js` |
| AI assistant panel (browser) | `public/js/assistant.js` |
| Secrets template (copy to `.env`) | `.env.example` |
| Browser test for Likes/compare | `tests/likes.e2e.mjs` |
| Tests for the AI assistant (mocked Gemini) | `tests/assistant.test.mjs`, `tests/assistant.e2e.mjs` |
| Colours, spacing, layout | `public/css/styles.css` |
| API and server | `server/index.js` |
| Data checker | `server/validate.js` |
| Method and design notes | `docs/` |
| Rules for AI assistants | `CLAUDE.md` |

Data files are re-read on every request: edit a JSON file, save, refresh the browser. Edits to `app.js` or `styles.css` also only need a refresh. The dev server restarts itself when server code changes.

## 3. Everyday jobs
**Add a product:** add an entry to `products.json` (copy an existing one; leave unknown specs out and they will read "Not provided"), add at least one offer in `offers.json`, then `npm run validate`.
**Add a review source:** add an entry to `sources.json` (id, platform, title, url, `chk` = the date you actually read it, `rel` = "Exact model…" or "RELATED MODEL: …", a summary in your own words). To include it in the score, add a line in `scoring.json` → `TONE`: `"SOURCE-ID": [reading 1–5, "outlet-key", 1 or 0.6, "reason"]`. Use 1 for editorial reviews, 0.6 for forum posts, and the same outlet key for pieces from one outlet.
**Update a price:** set `price` and set `chk` to the date you read it on the retailer page. If you cannot verify it, set `price` to `null` and `chk` to `null`.
**Add a photo:** put the file in `public/images/<brand>/`, then add a record to the `images.json` array: `id, p` (product id), `file`, `view` (front/back/side/detail/lifestyle), `alt`, `src`, `by`, `rights`, `rightsNote`, `hosting`. Array order is gallery order; the first photo for a product is its main photo. The existing project photos are authorized for demo purposes. For any new photo, record its permissions accurately and leave `"rights": "unconfirmed"` until authorization is established. Photos with 2+ records get a swipeable carousel on the home card and a gallery with thumbnails on the product page; clicking any photo (or the Enlarge button, or Enter on a focused carousel) opens a full-screen viewer.
**Add a YouTube review:** only after opening the video and confirming it covers that exact model. Entry fields: `id, p, title, channel, url, videoId, rel, checked`.
**Change colours:** edit the `:root` variables at the top of `styles.css`.

**Likes and comparison:** visitors tap **Like** (heart) on any jacket; the header shows **My Likes (N)**. Likes are private: stored only in the browser's localStorage key `marinebuy:likes` (`{v, ids, sel}`), never sent to the server, no account. Up to 200 jackets can be liked; My Likes opens a three-panel research workspace with two jackets selected by default. Use the checkboxes to compare up to four; removing a comparison keeps the Like. Select priority bubbles to bring relevant rows first and see evidence-based explanations. Notes, priorities, visible rows, differences-only mode, and research view are stored separately under `marinebuy:workspace`. A deliberately cleared selection stays cleared. Notes never go in shared URLs. Only the comparison page puts product IDs in the URL (`#/compare?cmp=a,b`) so it can be shared. Removing a jacket from a comparison keeps it in Likes. Old `?cmp=` links are migrated into Likes once, on the first visit after the update (with an Undo).

**Checks:** `npm test` runs `npm run validate` (data rules), `npm run test:research` (recommendation and workspace storage rules) and `npm run test:assistant` (AI endpoint with a mocked Gemini; no key or network needed). With the server running, `npm run test:assistant-e2e` checks the assistant panel in headless Chrome (Gemini mocked inside the browser), and `npm run test:e2e` drives headless Google Chrome through liking, persistence, My Likes, comparison, keyboard, reduced motion and 375px layout (no extra packages; set `CHROME=/path/to/chrome` if Chrome is elsewhere).

API (useful for testing): `/api/catalog`, `/api/products`, `/api/products/gill-os2`, `/api/health`, `/api/research-chat/status`.

**Add fit evidence:** add a record to `data/fit-evidence.json` only when a stored source (or the brand's spec page) actually says something about fit: `id` (`FIT-...`), `p`, `sourceId` (the `sources.json` id, or `null` for a brand spec page), `url`, `brand`, `model`, `relevance` (copy the source's `rel`, including `RELATED MODEL: …`), `sourceType` (official size chart / manufacturer claim / retailer review / independent review / community report), `areas` (hips, hem, chest, shoulders, sleeves, torso length, mobility, layering, overall), `garmentSize` and `wearer` (only if the source states them, else `null`), `summary` (your own words, faithful), `checked`, `published`, `fullyReviewed` (`true` full text, `false` search excerpt, `null` not recorded), `limitations`. Never add private interview details without permission.
**Add an official size chart:** add to `data/size-charts.json`: `{ "id", "p", "url", "checked", "measurementType": "body" | "garment", "unit": "cm" | "in", "sizes": [{ "label": "M", "chest": [96, 101], "hips": [...] }], "notes": "qualifications from the chart" }`. Keep body charts and garment-measurement charts as separate records. Then `npm run validate`.

## 3a. AI research assistant (Google Gemini)
The right-hand **Think it through** panel on My Likes is an AI research assistant. It is labelled as AI (never a person or an owner) and works without typing: choose priority bubbles (Lower price, Lighter weight, Wet-weather protection, Breathability, Room for layers, Help with fit → optional fit follow-ups). Bubbles highlight comparison rows immediately; after a short pause the assistant gives guidance for the selected jackets, asks at most one follow-up question with quick-reply options, lists missing information, and cites stored evidence. A text box and optional body measurements are available but never required.

**Set it up (local):**
1. Get a Gemini API key at https://aistudio.google.com/apikey (do not paste it into chats or commit it).
2. `cp .env.example .env`, then edit `.env` and set `GEMINI_API_KEY=...`. Optionally set `GEMINI_MODEL`.
3. `npm install` (adds `@google/genai` 2.26.0), then `npm start` and open http://localhost:3000/#/likes. Check http://localhost:3000/api/research-chat/status shows `"configured": true` (it never shows the key).

**Model:** `gemini-3.8-flash` by default, listed as the stable Flash model on https://ai.google.dev/gemini-api/docs/models when checked on 2026-10-19. Change it with `GEMINI_MODEL` without code changes. The call uses Google's Interactions API (`ai.interactions.create`) with a JSON schema, `store: false`, low thinking level, no SDK retries.

**How it stays honest:**
- The browser sends only product IDs, priority IDs, the typed question, the last 6 conversation turns and (if the user chooses) body measurements. The server looks up products, prices, sources, fit evidence and size charts from `/data`; browser-supplied product "facts" are ignored. Likes and notes are never sent. The whole catalog is never sent.
- System rules live in `server/assistant.js` (`SYSTEM_INSTRUCTION`). Retrieved documents and user text are wrapped as data, not instructions.
- The model's JSON is validated server-side: product, evidence, row and priority IDs must be in the allowlist for that request, otherwise they are dropped (and the page says how many). Citation links are built from stored records, never from model text; URLs, HTML and Markdown in model text are stripped. The page renders everything as plain text and only runs its own allowlisted actions (highlight rows, add a priority, send a quick reply).
- Limits: 500-character questions, 6 history turns × 1,200 characters, 16 KB request body, 1–4 products, 2,048 output tokens, 20-second timeout, no retries, 8 requests/minute and 60/hour per IP, 4 concurrent requests. Server logs contain only an error code and status, never messages, measurements or the key.
- If the key is missing, the quota is reached, the network fails or the reply cannot be verified, the panel says so plainly. The rules-based "From the recorded research" summaries (not AI) and all comparison tools keep working. There is no scripted fallback pretending to be AI.
- Measurements are optional, kept in memory for the visit, saved to this browser (`marinebuy:fit-profile`) only if "Remember on this device" is ticked, removable with "Forget measurements", and never put in URLs. The conversation is kept only in memory; "Clear conversation" empties it.

## 4. Using Claude Code inside VS Code to maintain it
Install the **Claude Code** extension, open this folder, and ask for changes in plain language, for example "add a source for the Musto BR2 from this URL". `CLAUDE.md` holds the project's honesty rules so the assistant follows them. After any change: `npm run validate`, then check the site in the browser.

## 5. Known gaps (honest list)
- Only Gill OS2 and Zhik OFS600 have enough independent feedback for a score. Musto, Helly Hansen and West Marine are "Not rated yet".
- Verified prices: Gill $395, Musto $430, Helly Hansen $295 (read 2026-10-15). Zhik and West Marine prices are unverified.
- Zhik and West Marine product pages could not be machine-read; their links are as supplied and unverified.
- The unidentified Amazon listing (B0GYR1JLG8) was removed from the demo on 2026-10-16; its records are kept in `data/archive/` (not loaded by the site).
- The existing 25 photos are authorized for demo purposes. Only the five main photos have a recorded source URL; the gallery photos' original URLs were not recorded.
- Most sources (all except the Motor Boat & Yachting review) were read from search excerpts only. No Reddit thread or YouTube video has been verified.
- Our 1–5 readings in `scoring.json` are editorial judgments. Waterproof figures are brand claims.
- The AI assistant has only been tested with mocked Gemini responses; a live call with a real key has not been run yet. Answer quality (for example refusing to guarantee fit, or not generalising one review) depends on the model following the server-side rules and must be spot-checked once a key is configured.
- No official size charts are recorded (`data/size-charts.json` is empty), so the assistant cannot check anyone's measurements against a chart; it says so. Needed: each brand's official size chart for the exact model (Gill OS26J, Musto 82084, Zhik OFS600, Helly Hansen 34484, West Marine P021338520), with URL, checked date, unit, and whether it lists body or garment measurements.
- Fit evidence is thin: 9 records, mostly search excerpts and earlier-generation Gill OS2 reports. No hip, hem, chest or shoulder evidence exists for any jacket; Zhik and West Marine have none.
- The rules-based summaries use deterministic rules. No garment weights are recorded. Waterproof test methods do not match; breathability uses incompatible or incomplete scales. Fit descriptions do not establish layering room or freedom of movement. These priorities explain the gaps rather than rank jackets.
- Not done: deployment, external retailer link click-through, quick view, cross-device Likes (needs accounts; planned).

## 6. Troubleshooting
**Site won't load / `npm run dev` hangs or keeps restarting:** this folder is on the iCloud-synced Desktop. With "Optimize Mac Storage" on, macOS can offload project files (including `node_modules` and `data/`), and Node then waits for them to download. Fix: in Finder, right-click the MarineBuy folder → **Download Now** (or move the project out of Desktop/Documents, e.g. to `~/Projects`). `npm run dev` only watches `server/`; data and front-end edits just need a browser refresh.

## 7. Deploying later
Any host that runs Node 20.12+ as a long-running server works (the AI endpoint needs a server; a static-only host is not enough): `npm install` then `npm start`. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, `PORT`) as environment variables in the host's secret settings, never in the repository. The rate limit is kept in memory per server process, so it resets on restart and is per instance; if the app runs behind a proxy, configure Express `trust proxy` so limits apply per visitor rather than per proxy. Deployment has not been tried.
