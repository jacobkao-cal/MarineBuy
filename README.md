# Marine Buy

Sailing-jacket research and comparison site: search, filters, product pages, private Likes (My Likes), 2–4 product comparison, source-backed feedback posts, and the Marine Buy Score.
Status: prototype with 5 jackets (see "Known gaps"). Last data check: 2026-10-15.

## 1. Open it in VS Code (first time)
1. Install **Node.js 20.12+** from nodejs.org (the "LTS" button). Install **VS Code** if needed.
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
| Research workspace and rules-based guide | `public/js/workspace.js` |
| Priority definitions and recommendation rules | `public/js/research.js` |
| Notes, priorities and view settings | `public/js/workspace-state.js` |
| Likes storage (localStorage, browser only) | `public/js/likes.js` |
| Device-local profile and onboarding screens | `public/js/accounts.js` |
| Fit evidence (one fit point per record, linked to its source) | `data/fit-evidence.json` |
| Official size charts (none recorded yet) | `data/size-charts.json` |
| Optional Gemini API code (not used by the static preview) | `server/assistant.js` |
| GitHub Pages static-site builder | `scripts/build-pages.mjs` |
| Secrets template (copy to `.env`) | `.env.example` |
| Browser tests for Likes, comparison, and local profiles/onboarding | `tests/likes.e2e.mjs` |
| Tests for the retained server-side Gemini endpoint (mocked) | `tests/assistant.test.mjs` |
| Colours, spacing, layout | `public/css/styles.css` |
| API and server | `server/index.js` |
| Data checker | `server/validate.js` |
| Method and design notes | `docs/` |
| Rules for AI assistants | `CLAUDE.md` |

The local server re-reads data files on each request. The GitHub Pages build bundles the current catalog into `dist/data/catalog.json`; rebuild after changing data. Front-end edits need a browser refresh locally. The dev server restarts itself when server code changes.

## 3. Everyday jobs
**Add a product:** add an entry to `products.json` (copy an existing one; leave unknown specs out and they will read "Not provided"), add at least one offer in `offers.json`, then `npm run validate`.
**Add a review source:** add an entry to `sources.json` (id, platform, title, url, `chk` = the date you actually read it, `rel` = "Exact model…" or "RELATED MODEL: …", a summary in your own words). To include it in the score, add a line in `scoring.json` → `TONE`: `"SOURCE-ID": [reading 1–5, "outlet-key", 1 or 0.6, "reason"]`. Use 1 for editorial reviews, 0.6 for forum posts, and the same outlet key for pieces from one outlet.
**Update a price:** set `price` and set `chk` to the date you read it on the retailer page. If you cannot verify it, set `price` to `null` and `chk` to `null`.
**Add a photo:** put the file in `public/images/<brand>/`, then add a record to the `images.json` array: `id, p` (product id), `file`, `view` (front/back/side/detail/lifestyle), `alt`, `src`, `by`, `rights`, `rightsNote`, `hosting`. Array order is gallery order; the first photo for a product is its main photo. Existing project photos are authorized by the site owner for demo purposes. For new photos, record permissions accurately and leave `"rights": "unconfirmed"` until authorization is established. Photos with 2+ records get a swipeable carousel on the home card and a gallery with thumbnails on the product page; clicking any photo (or the Enlarge button, or Enter on a focused carousel) opens a full-screen viewer.
**Add a YouTube review:** only after opening the video and confirming it covers that exact model. Entry fields: `id, p, title, channel, url, videoId, rel, checked`.
**Change colours:** edit the `:root` variables at the top of `styles.css`.

**Local profiles, Likes, and comparison:** guest browsing is always available. Visitors can create a passwordless local profile using a display name, then return by choosing that profile on the same browser. This is not a secure identity or a cross-device account. The profile stores a five-step sailing and fit questionnaire, with optional body measurements, and keeps each profile's Likes and research notes separate. On profile creation, an explicit unchecked option can copy the current guest Likes and research notes into the profile; nothing is moved or removed from guest browsing. Sign out preserves the local profile; deleting one requires confirmation and clears that profile's data. Profiles, measurements, Likes, and notes are stored in browser localStorage and are never sent to the server.

Visitors tap **Like** (heart) on any jacket; the header shows **My Likes (N)**. Guest Likes use `marinebuy:likes`; profile-specific Likes and workspace research use keys suffixed with that profile's local ID. Up to 200 jackets can be liked; My Likes opens a three-panel research workspace with two jackets selected by default. Use the checkboxes to compare up to four; removing a comparison keeps the Like. Select priority bubbles to bring relevant rows first and see evidence-based explanations. Notes, priorities, visible rows, differences-only mode, and research view are stored separately in `marinebuy:workspace` (guest) or a profile-scoped workspace key. A deliberately cleared selection stays cleared. Notes and personal profile data never go in shared URLs. Only the comparison page puts product IDs in the URL (`#/compare?cmp=a,b`) so it can be shared. Old `?cmp=` links are migrated into Likes once, on the first visit after the update (with an Undo).

**Checks:** `npm test` validates curated data, checks research/storage, local profile storage, and the server-side Gemini endpoint using a mocked model, and builds/verifies the Pages artifact. With the local server running, `npm run test:e2e` drives headless Google Chrome through Likes, comparison, local profile creation/sign-in/onboarding/deletion, unit conversion, keyboard, reduced motion and the 375px layout (no extra packages; set `CHROME=/path/to/chrome` if Chrome is elsewhere).

API (local server): `/data/catalog.json`, `/api/catalog`, `/api/products`, `/api/products/gill-os2`, `/api/health`. The static Pages preview does not use Gemini endpoints.

**Add fit evidence:** add a record to `data/fit-evidence.json` only when a stored source (or the brand's spec page) actually says something about fit: `id` (`FIT-...`), `p`, `sourceId` (the `sources.json` id, or `null` for a brand spec page), `url`, `brand`, `model`, `relevance` (copy the source's `rel`, including `RELATED MODEL: …`), `sourceType` (official size chart / manufacturer claim / retailer review / independent review / community report), `areas` (hips, hem, chest, shoulders, sleeves, torso length, mobility, layering, overall), `garmentSize` and `wearer` (only if the source states them, else `null`), `summary` (your own words, faithful), `checked`, `published`, `fullyReviewed` (`true` full text, `false` search excerpt, `null` not recorded), `limitations`. Never add private interview details without permission.
**Add an official size chart:** add to `data/size-charts.json`: `{ "id", "p", "url", "checked", "measurementType": "body" | "garment", "unit": "cm" | "in", "sizes": [{ "label": "M", "chest": [96, 101], "hips": [...] }], "notes": "qualifications from the chart" }`. Keep body charts and garment-measurement charts as separate records. Then `npm run validate`.

## 3a. Research guide (no Gemini in the public preview)
The right-hand **Think it through** panel is a rules-based research guide, not an AI assistant. Priority bubbles reorder and highlight relevant comparison rows. Suggestions use only stored product data and evidence; missing information remains unknown. The GitHub Pages build excludes the browser Gemini client and does not send questions, measurements, Likes or notes to an AI provider.

The Express Gemini endpoint and its tests remain in the repository for possible future backend hosting, but they are not connected to the public frontend. GitHub Pages serves static files and cannot run that endpoint.

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
- The Gemini endpoint has only been tested with mocked responses; the public static site does not use Gemini.
- No official size charts are recorded (`data/size-charts.json` is empty), so fit cannot be checked against a chart. Needed: each brand's official size chart for the exact model (Gill OS26J, Musto 82084, Zhik OFS600, Helly Hansen 34484, West Marine P021338520), with URL, checked date, unit, and whether it lists body or garment measurements.
- Fit evidence is thin: 9 records, mostly search excerpts and earlier-generation Gill OS2 reports. No hip, hem, chest or shoulder evidence exists for any jacket; Zhik and West Marine have none.
- The rules-based summaries use deterministic rules. No garment weights are recorded. Waterproof test methods do not match; breathability uses incompatible or incomplete scales. Fit descriptions do not establish layering room or freedom of movement. These priorities explain the gaps rather than rank jackets.
- Not done: Pages deployment, external retailer link click-through, quick view, cross-device Likes (needs accounts; planned).

## 6. Troubleshooting
**Site won't load / `npm run dev` hangs or keeps restarting:** this folder is on the iCloud-synced Desktop. With "Optimize Mac Storage" on, macOS can offload project files (including `node_modules` and `data/`), and Node then waits for them to download. Fix: in Finder, right-click the MarineBuy folder → **Download Now** (or move the project out of Desktop/Documents, e.g. to `~/Projects`). `npm run dev` only watches `server/`; data and front-end edits just need a browser refresh.

## 7. GitHub Pages preview
The preview is a static site: it includes the catalog as JSON, but not the Express server or Gemini browser client. Likes, notes and comparison preferences remain in each visitor's browser.

1. In the GitHub repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
2. `npm run build:pages` creates `dist/` locally. Pushing a change to `main` runs `.github/workflows/pages.yml`, which tests, builds and deploys the site.
3. Check **Actions** for a successful **Deploy GitHub Pages** run. The expected URL is `https://jacobkao-cal.github.io/MarineBuy/`; use it only after deployment succeeds.

For local development with the Express API, use `npm run dev` and open http://localhost:3000. The static preview does not support Gemini questions; adding AI later requires hosting the backend separately and configuring its endpoint safely.

Because this repository is public, all committed source, curated research data and demo-authorized images can be viewed and downloaded. Do not commit credentials, private interview details or personal profile data.
