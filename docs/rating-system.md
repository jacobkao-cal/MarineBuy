# Marine Buy Score: rating system and per-product ratings

Status: prototype, evidence as of 2026-10-15. Scores are provisional and will change as sources are added.

## 1. What the score is

A single 0–5 number per jacket that combines **how well the product is specified** with **what independent people and outlets say about it**. It is shown as, for example, `4.3 / 5`, always with an evidence label and a link to the breakdown.

It is **not** an average of retailer star ratings, and it is **not** shown for a product until there is enough independent evidence.

## 2. Formula

```
Marine Buy Score = average of the parts that are available:
    Spec score      (50%)
    Feedback score  (50%)
```

If only one part is available, the score equals that part. If the evidence threshold (section 5) is not met, no score is shown.

### 2.1 Spec score (0–5)

Based on the **waterproof rating only**, in millimetres of hydrostatic head:

| Rating | Points |
|---|---|
| 30,000mm or more | 5.0 |
| 20,000–29,999mm | 4.5 |
| 15,000–19,999mm | 3.5 |
| 10,000–14,999mm | 3.0 |
| Below 10,000mm | 2.0 |

Rules:
- Where sources cite different figures, use the **lowest** figure cited.
- These numbers are brand claims, measured by different methods, so they are only a rough guide.
- If no numeric rating is published, the spec score is "not scorable". It is **not** treated as zero.
- Breathability is **not scored**: brands use incompatible scales (Gill percentage bands, Zhik g/m², others none).
- Other features (taped seams, reflective trim, pockets) are not scored yet, because a feature missing from a product page does not prove it is absent.

### 2.2 Feedback score (0–5)

A weighted average of an editorial reading (1–5) of each **independent** source.

**Weight per source** = base weight × relevance factor

| Source type | Base weight |
|---|---|
| Independent editorial review | 1.0 |
| Forum or community post (self-reported use) | 0.6 |
| Brand or retailer text, brand-hosted star ratings | 0 (shown, not scored) |

| Relevance | Factor |
|---|---|
| Exact model | 1.0 |
| Earlier version or related model | 0.5 |

**Same outlet counts once.** Several pieces from one outlet are averaged first, and the group takes the highest weight among them.

**Reading scale:** 4.5 very positive, 4.0 positive, 3.5 positive with notable fit or quality caveats, 3.0 mixed, 2.0 negative, 1.0 very negative. The readings are editorial judgments. They are listed per source so readers can disagree.

## 3. Evidence label

Total weight = sum of weights after the same-outlet rule.

| Total weight | Label |
|---|---|
| Under 1.0 | No score shown ("Not rated yet") |
| 1.0–1.9 | Provisional, low evidence |
| 2.0–3.9 | Moderate evidence |
| 4.0 or more | High evidence |

## 4. Ratings by product

| Product | Marine Buy Score | Evidence | Spec part | Feedback part | Total weight |
|---|---|---|---|---|---|
| Gill OS2 Offshore Jacket (OS26J) | **4.3 / 5** | Moderate | 4.5 | 4.13 | 3.1 |
| Zhik OFS600 Offshore Cruising Jacket | **3.8 / 5** | Provisional, low | 3.5 | 4.0 | 1.0 |
| Musto BR2 Offshore Jacket 2.0 | Not rated yet | none | 5.0 (not shown) | none | 0 |
| Helly Hansen Pier 4.0 Jacket | Not rated yet | none | not scorable | none | 0 |
| West Marine Third Reef Jacket | Not rated yet | below threshold | not scorable | one earlier-version review | 0.5 |

### 4.1 Gill OS2 Offshore Jacket (OS26J), 4.3 / 5

**Spec part: 4.5.** Gill's page shows a 20,000+mm band and text citing 30,000mm. A retailer listing says tested to 20,000mm. The lowest figure, 20,000mm, is used.

**Feedback part: 4.13** (12.8 weighted points ÷ 3.1 total weight).

| Source | Scope | Our reading | Weight | Why |
|---|---|---|---|---|
| Motor Boat & Yachting review (5 Mar 2026) | Exact | 4.0 | 1.0 | Positive; light seam tape, no seat or elbow reinforcement, slightly bulky |
| Motor Boat & Yachting 2026 group test | Exact | 4.5 | (same outlet, averaged to 4.25) | Named "Best All-Rounder" |
| West Marine Community forum | Earlier version | 4.5 | 0.3 | Self-reported dry and warm in 18 hours of rain |
| Power & Motoryacht | Earlier version | 3.5 | 0.5 | Comfortable and warm; sleeves long, collar very high |
| Yachting World buyer's guide | Earlier version | 4.0 | 0.5 | Good value; breathability behind Gore-Tex |
| Practical Sailor "Foulie Faceoff" | Earlier version | 4.5 | 0.5 | Good or Excellent in every test category |
| SailNet forum thread | Earlier version | 4.0 | 0.3 | Poster names it as go-to gear |
| Marine Superstore listing | Exact | not scored | 0 | Repeats brand claims |

Calculation: (4.25×1.0 + 4.5×0.3 + 3.5×0.5 + 4.0×0.5 + 4.5×0.5 + 4.0×0.3) ÷ 3.1 = 4.13. Score = (4.5 + 4.13) ÷ 2 = 4.31, shown as **4.3**.

**Known conflicts shown on the page:** bulk (2026 review says bulkier, older forum post says not bulky); breathability (older forum post says very breathable, older guide says behind Gore-Tex); waterproof figure (30,000mm vs 20,000mm).

**Caveats:** only the Motor Boat & Yachting review was read in full. The other sources were read from search excerpts. No Reddit thread has been found.

### 4.2 Zhik OFS600 Offshore Cruising Jacket, 3.8 / 5 (provisional)

**Spec part: 3.5.** Zhik states 15,000mm waterproof, 15,000 g/m² breathability, 2-layer.

**Feedback part: 4.0.**

| Source | Scope | Our reading | Weight | Why |
|---|---|---|---|---|
| YACHT (8 Apr 2025) | Exact | 4.0 | 1.0 | Good value for coastal and occasional offshore; slightly less protection than OFS700 |

Score = (3.5 + 4.0) ÷ 2 = 3.75, shown as **3.8**. Only one source, so it is flagged provisional. The Zhik product page could not be read by the research tool, and no US price is verified.

### 4.3 Musto BR2 Offshore Jacket 2.0, not rated yet

- Spec part would be 5.0 (Musto claims 30,000mm), but it is a brand claim and is not shown on its own.
- No independent review found yet.
- Musto's own site shows a 4.4 rating (review count not shown). This is shown on the page and **excluded** from the score because the seller hosts it.
- **To get a score:** one independent review of the exact BR2 Offshore Jacket 2.0.

### 4.4 Helly Hansen Pier 4.0 Jacket, not rated yet

- No numeric waterproof rating on the product page, so the spec part is not scorable.
- Helly Hansen's own site shows 4.9 from 148 ratings. Shown, **excluded** from the score.
- **To get a score:** one independent review of the exact Pier 4.0 (or two of earlier versions).

### 4.5 West Marine Third Reef Jacket, not rated yet

- Spec part not scorable (no verified specs for this exact listing).
- One independent review (Power & Motoryacht), read as 4.0, of an unknown generation: weight 1.0 × 0.5 = **0.5**, under the 1.0 threshold.
- The current listing page could not be read, and no price is verified.
- **To get a score:** one more independent review, or any review confirmed to cover the exact current model.

## 5. Why a threshold exists

Without a minimum, a jacket with no independent reviews can outrank a well-reviewed one simply because its marketing claims a high waterproof figure. Musto would have scored about 4.7 from its own claim and its own site rating. The 1.0 weight threshold, about one independent review of the exact model, prevents that.

## 6. Limits of the method

- The 1–5 readings are my editorial judgments, not measurements.
- Waterproof ratings are brand claims on different tests.
- Forum ownership is self-reported and unverified.
- Five products is not a market survey, so scores should not be compared with jackets outside this set.
- Weights and thresholds are a starting design, not a validated model. They can be changed, and the effect on every product can be re-computed.

## 7. What would improve the system

1. Independent review links for Musto BR2, Helly Hansen Pier 4.0, West Marine Third Reef, and Zhik OFS600.
2. Verified Reddit and sailing-forum threads for each exact model.
3. A documented, comparable breathability figure for each jacket.
4. Real customer reviews obtained under a licensed feed or with permission, which would allow star averages and review counts with ownership marked.
