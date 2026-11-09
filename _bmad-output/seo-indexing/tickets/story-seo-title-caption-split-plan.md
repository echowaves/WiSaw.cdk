---
title: 'SEO text slots carry two texts, not one'
type: 'feature'
ticket: '3'
created: '2026-11-09'
status: 'built'
review: 'quick'
review_source: 'pinned'
baseline_revision: '116ca8a3fa5725a44e86a6c292e3ed14ae3c9995'
route: 'full'
route_source: 'auto'
risk: 'medium'
review_loop_iteration: 1
lenses_ran: ['quick']
---

# Plan: SEO text slots carry two texts, not one

Intent: A photo with both AI tags and a comment stops putting the same words in every SEO text slot — `image:title` labels the picture with the tag list while `image:caption` carries the newest comment, and the page's meta description takes the tag list whenever the page title is already headed by that comment. Today one string feeds all of them, so 21k pages repeat one text twice and the second slot adds nothing.

Approach: Put the split in one place both writers can reach — a pure helper next to the sidecar contract module, which already owns "which text goes in which slot" and is already required from TypeScript resolvers and from the JavaScript edge code. The sitemap generator calls it for photo `image:title`/`image:caption` and for `video:title`, and keeps its existing comment-first `<video:description>` with its own 2048 cap. The edge text builder changes only the lead of the meta description: when a tag list exists it leads with the tags, because the title above it is already headed by the comment — the title head, the body block, the JSON-LD and every byte-level HTML rewrite stay untouched, so the machinery that once deindexed 22k pages is not in this diff.

Analogous existing code:
- `lambda-fns/utilities/seoSidecar.ts` — `buildSeoSidecar()` already assigns comment → `caption`, labels → `labels`, and truncates; the new helper is the same contract for slots the sidecar does not carry, so it belongs beside it rather than inside one consumer.
- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoText.js` — `imageTitle` (tags) against `imageCaption` (comment) is the og split this plan extends; its `truncate()` word-boundary rule is what the helper mirrors.

## Validation policy

Source of truth: the assertion-bearing tests in `tests/`, run one file at a time with `npx mocha --exit <file>` (and `--require @babel/register` where the file loads TypeScript, as `npm test` does).

- Every change to `tests/seo-crawler-contract.js`: `npx mocha --exit --require @babel/register tests/seo-crawler-contract.js`.
- New `tests/sitemap-image-text.js`: `npx mocha --exit --require @babel/register tests/sitemap-image-text.js`.
- Every change to `lambda-fns/lambdas/injectMetaTagsLambdaFunction/**` and every edit to a file named in the Bounds list: `npx mocha --exit --require @babel/register tests/inject-meta-tags.js` — byte-exact HTML is load-bearing here.
- Every change to `lambda-fns/utilities/seoSidecar.ts`: `npx mocha --exit tests/upload-seo-sidecar.js` and `npx mocha --exit tests/seo-sidecar-lifecycle.js`.
- Every change to `lambda-fns/lambdas/generateSiteMap/index.ts`: `npx tsc -noEmit -skipLibCheck` plus the new sitemap test file.
- Before hand-off: `npm test`, accepting only the 5 known `getSeasonBoundaries` timezone failures recorded in this initiative's memlog; and `npx ts-standard <each changed .ts file>`.

## Boundaries & Constraints

Confirmed with: user, through ticket 3 (`_bmad-output/seo-indexing/tickets/story-seo-title-caption-split.md`), which the user handed to `bmad-build`; the title/caption mapping itself is a recorded builder decision (memlog 2026-11-09) presented for confirmation at review.
Bounds:
- Do not touch: `lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js` — every byte-exact HTML rewrite, canonical rule and the `<h1>`/JSON-LD body block (a silent mismatch deindexed 22k pages).
- Do not touch: `buildSeoSidecar`, `sidecarKey`, `putSeoSidecar`, `pickLabels`, `locationText` in `lambda-fns/utilities/seoSidecar.ts`, nor the sitemap's sidecar publish block (`uploadSeoSidecarsForIds`) — entries 1 and 2 of this initiative are still in review over exactly those lines.
- Do not touch: `imageTitle`/`imageCaption` selection in `seoText.js`, `photo.js`, `video.js`, the `lastComment` writers, or any S3/AWS call beyond what the test stubs fake.
- Existing behavior to preserve: page `<title>` head order (comment, else first label, else place+month), title ≤ 68 chars and description ≤ 158 chars, `video:description` under the same caption rule and 512-character limit as photo captions (ticket criterion 4 overrides this plan's earlier 2048 bound), the sitemap's identity-bearing fallback title (`WiSaw <kind> — <place>, <month> <id>`), and every currently passing case in `tests/seo-crawler-contract.js`.
- New files allowed: `tests/sitemap-image-text.js`. Nothing else new.
- Decisions already made (don't re-open): tags → title and comment → caption at image level; page title keeps the comment head; the meta description is what moves to the tags.

## Code Map

| File | Role here | Action |
|------|-----------|--------|
| `lambda-fns/utilities/seoSidecar.ts` | Single home of "which text goes in which slot"; pure, no `psql`, so both stacks and tests can require it | Modify: add `truncateWords`, `IMAGE_TITLE_MAX = 100`, `IMAGE_CAPTION_MAX = 512`, exported `splitImageText(media, kindLabel)` → `{ title, caption }`, taking the row shape both callers already hold. Cyclomatic complexity ≤ 8. |
| `lambda-fns/lambdas/generateSiteMap/index.ts` | Emits the sitemap entries; today builds one `summary` and writes it into both slots | Modify: photo entry uses `splitImageText` for `image:title`/`image:caption`; video entry uses its `title` for `video:title` and keeps `clean(video.lastComment) \|\| title` sliced to 2048 for `video:description`. Remove the shared `summary`. |
| `lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoText.js` | Builds the edge SEO fields consumed by photo/video handlers | Modify: `lead` picks the tag sentence when `labels.length > 0`, else the caption as today; update the comment above it to state the pairing rule. |
| `tests/sitemap-image-text.js` | Proves the split at both levels | Create: helper unit cases (both sources → two different texts; no comment → equal; no labels → title fallback, caption = comment) + one end-to-end `main()` run with stubbed `psql` and `S3Client.prototype.send` asserting the emitted XML carries two distinct `<image:title>`/`<image:caption>`. |
| `tests/seo-crawler-contract.js` | The crawler contract | Modify: add cases "page title and meta description are not the same text when a comment and tags exist" and "the description leads with the tag list in that case"; keep every existing case untouched. |

## I/O & Edge-Case Matrix

| Case | Input | Expected output |
|------|-------|-----------------|
| Comment + tags (photo, sitemap) | `lastComment = 'A heron at dawn'`, labels `['heron','wetland']` | `image:title = 'heron, wetland'`; `image:caption = 'A heron at dawn'`; the two differ |
| No comment (photo, sitemap) | `lastComment = null`, labels `['heron']` | `image:title === image:caption === 'heron'` (equality is allowed only here) |
| Comment, no tags (photo, sitemap) | `lastComment = 'A heron at dawn'`, labels `[]`, place `Krasnodar`, `createdAt` Nov 2026 | title is the identity text (`WiSaw photo — Krasnodar, Nov 2026 <id>`) and **not** the comment; caption = `'A heron at dawn'`; ≤ 100 / ≤ 512 |
| Neither (photo, sitemap) | both empty | `title = caption = 'WiSaw photo <id>'`, non-empty |
| Comment + tags (video) | comment + labels | `video:title` = tag list; `video:description` = comment under the caption rule and its 512 limit; they differ |
| Comment + tags (page) | caption `'A heron at dawn'`, labels `['heron','wetland']`, place, month | `<title>` head still `'A heron at dawn …'`; `metaDescription` starts with `'heron, wetland unaltered photo'`; title ≠ description; ≤ 68 / ≤ 158 |
| Comment, no tags (page) | caption only | Description leads with the caption as today (`'A heron at dawn - free photo on WiSaw.'`) |
| No comment, tags (page) | labels only | Title head and description lead from labels as today |

## Tasks & Acceptance

1. [x] `lambda-fns/utilities/seoSidecar.ts` — add the shared splitter.
   `truncateWords(value, max)` mirrors seoText's rule (cut at last space before `max`, trim trailing punctuation, otherwise hard-cut), private. Exported:
   ```ts
   export const IMAGE_TITLE_MAX = 100
   export const IMAGE_CAPTION_MAX = 512

   export function splitImageText (input: { labels?: string[] | null, comment?: string | null, location?: string | null, kindLabel?: string, id: string | number }): { title: string, caption: string } {
     const tags = pickLabels(input.labels ?? [], 8).join(', ')
     const comment = clean(input.comment)
     const place = clean(input.location)
     const fallback = `WiSaw ${clean(input.kindLabel) || 'photo'}${place ? ` — ${place}` : ''} ${input.id}`
     const title = truncateWords(tags || comment || fallback, IMAGE_TITLE_MAX)
     return { title, caption: (comment || title).slice(0, IMAGE_CAPTION_MAX) }
   }
   ```
   DoD: helper returns two different texts for the first matrix row; `npx tsc -noEmit -skipLibCheck` clean.

2. [x] `lambda-fns/lambdas/generateSiteMap/index.ts` — stop writing one text into both slots.
   Replace the `summary`/`title` block: compute `location` first (already done), then `const pair = splitImageText({ labels, comment: photo.lastComment, location, kindLabel: 'photo', id: photo.id })`; emit `escapeXml(pair.title)` in `<image:title>` and `escapeXml(pair.caption)` in `<image:caption>`. For the video entry reuse the helper's `title` for `<video:title>` and keep `clean(video.lastComment) || pair.title` sliced to 2048 in `<video:description>`. Leave the labels SQL, the sidecar publish block and everything else alone.
   DoD: sitemap test file green; `npx tsc -noEmit -skipLibCheck` clean.

3. [x] `lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoText.js` — move only the description lead.
   Replace the caption-first `lead` branch with: when `labels.length > 0`, lead from `truncate(labels.slice(0, 4).join(', ') + \` unaltered ${kindLabel}\`, leadBudget)`; otherwise keep today's caption branch unchanged. Update the comment above `const subject` so it states the pairing rule (title keeps its head; the description carries the other text) instead of "the title and description share this lead".
   DoD: new contract cases green, all pre-existing contract cases still green, `tests/inject-meta-tags.js` byte-exact suite green.

4. [x] `tests/sitemap-image-text.js` — prove it at both levels.
   Harness header copied from `tests/upload-seo-sidecar.js`: `require('ts-node/register/transpile-only')`, a `.pem` require-cache stub with an `after()` restore, and a stubbed `S3Client.prototype.send`. Unit cases over `splitImageText` for every row of the matrix above, then one `main()` run with `psql.connect`/`query`/`clean` stubbed (one photo with comment + labels, one with neither) capturing the `PutObject` body and asserting both texts appear and differ.
   DoD: `npx mocha --exit --require @babel/register tests/sitemap-image-text.js` green.

5. [x] `tests/seo-crawler-contract.js` — pin the page-level rule.
   Add two cases in the `buildSeoFields` block: (a) caption + labels → `seo.pageTitle !== seo.metaDescription`; (b) same input → `seo.metaDescription.startsWith('heron, wetland')`, `seo.pageTitle` still starts with the caption, and both stay inside 68 / 158.
   DoD: `npx mocha --exit --require @babel/register tests/seo-crawler-contract.js` green.

## Implementation Notes

- Language: TypeScript for the helper and the generator (match each file), plain CommonJS JS in `seoText.js`; no new dependencies; deps stay pinned exactly.
- Naming: `splitImageText`, `truncateWords`, `IMAGE_TITLE_MAX`, `IMAGE_CAPTION_MAX` — the module already exports in this style (`buildSeoSidecar`, `locationText`).
- Keep `splitImageText` free of `psql`/AWS imports so `tests/sitemap-image-text.js` and the edge side can require it without a stub.
- The helper deliberately mirrors the sidecar's slot meanings (comment → caption, tags → labels) so one sentence explains every surface: "the tag list labels the picture, the newest comment captions it, and neither text is used twice on the same surface."

## Plan Change Log

- **Loopback 1 (`review_loop_iteration: 1`), 2026-11-09** — triggered by the Quick lens finding that this plan's I/O matrix row 3 and its "preserve the 2048-character `video:description` cap" bound contradicted ticket 3 criteria 3 and 4, which were never amended. Amended: matrix row 3 now requires a tag-less commented photo to get an identity-bearing title (place + capture month, then id) that is *not* the comment; matrix row "Comment + tags (video)" and the Bounds line now put `video:description` under the caption rule and its 512-character limit. Known-bad state avoided: a commented photo with no Rekognition labels publishing the same sentence in title and caption — the exact defect this ticket exists to remove. KEEP: the two-text rule; tags (first three, matching `og:image:title`) → image title; newest comment → image caption; page title keeps its comment head while the meta description takes the tag list only when both texts exist; a lead sentence for that case that does not repeat the word "unaltered" used by the brand tail; `splitImageText(media, kindLabel)` living in `seoSidecar.ts` and pure; `tests/sitemap-image-text.js` driving the real `main()` with stubbed `psql`/S3; the 100/512 caps.
- 2026-11-09: the Quick review's claims file must match the code. `splitImageText` takes `(media, kindLabel)` — the row shape both callers already hold — rather than the object argument sketched at plan time; the plan also wrongly recalled a place name in the old `WiSaw <kind> <id>` title that `generateSiteMap` emitted. Superseded below: the fallback now *does* carry place and capture month, per ticket criterion 3. KEEP: the two-text rule, tags→title / comment→caption, the description moving to the tags only when a comment already heads the title, the 100/512/2048 caps, and `tests/sitemap-image-text.js` driving the real `main()`.
- **Loopback 1, second pass (`lenses_ran: ['quick']` twice), 2026-11-09** — the re-review caught three things the first patch left wrong, all applied: (a) `identityTitle` embedded the raw UUID even when place and month were known, so an untagged photo's image title was a 36-character id trailing behind a place name — and when the place name was long, `truncateWords` cut the id off entirely, which is how same-city untagged photos would have shared one title anyway. It now uses place + capture month when either is known and the id only when neither is, matching criterion 3's "or from the photo's identity when neither is known"; page uniqueness is unaffected because `seoText.js` still titles an unknown page `wisaw <kind> <id>`. (b) The tag-list rule was only half aligned: the meta description lead listed four tags while every other slot listed three, so `TAG_TITLE_LIMIT = 3` now drives all four slots in both stacks. (c) This log's own first entry misdescribed the shipped fallback; corrected here. KEEP: everything logged above, plus the identity rule as amended.

## Review Triage Log

| Finding | Verdict | Evidence |
|---------|---------|----------|
| Req 3 unmet: tag-less commented photo repeats the comment as its image title (`seoSidecar.ts` `splitImageText`, pinned by `tests/sitemap-image-text.js`) — grouped with "the only coincide when there is no comment" comments being false | `medium` — bad_plan (loopback 1) | Verified at the helper: `titleSource` falls back to `comment` before the identity fallback, while ticket criterion 3 says the title is built from place + capture month or the photo's identity and "does not repeat the comment". Reachable for every photo whose Rekognition run produced no labels — a commented photo then ships one sentence in both slots, the defect this ticket exists to remove. |
| Req 4 unmet: `video:description` keeps a 2048 cap while photos are capped at 512 — grouped with the row above (same root cause: plan overrode ticket criteria) | `medium` — bad_plan (loopback 1) | Verified at `generateSiteMap/index.ts`: `description: (clean(photo.lastComment) \|\| title).slice(0, 2048)` while criterion 4 demands "under the same limits as photos". Content-only, but it leaves the stated rule unstateable in one sentence. |
| `seoText.js` lead change moves crawler-visible `<p>` and `VideoObject.description` too, so video descriptions lose the comment | `false` | Checked `photo.js:45,63`, `video.js:43,70`, `utils.js:132,154`: the same field feeds head and body, yes — but the comment still reaches the crawler as `<h1>` (page title head), image `alt` and Photograph/VideoObject `caption`, while the paragraph now carries a second distinct text. That is what the intent asks for; no bad outcome at the cited location. |
| Three different tag strings per photo: 8 labels in sitemap title, 3 in `og:image:title`, 4 in the description lead | `low` — patch | Verified: `splitImageText` calls `pickLabels([media])` with its default limit of 8 while `seoText.js:107` slices to 3 and `:104` to 4, so Google Image Search sees a different tag list than the page. Fix is one argument, no new surface. |
| "unaltered" appears twice in one meta description once the tags lead (`… unaltered photo. … Free photo on WiSaw - unaltered, taken with a phone camera`) | `low` — patch | Verified against the fixture: lead 39 chars + tail 109 → 131-char snippet with the word twice; previously only tag-only pages hit it, now every commented tagged page does. Cosmetic but visible in every SERP snippet. |
| Plan task 3 asked for the pairing rule above `const subject`; the comment sits only at `lead` | `low` — patch | Verified: `seoText.js:63` has no explanatory comment while the new block refers the reader back to "`subject` above". One-line direct correction. |
| `buildSeoFields` grows past AGENTS.md's cyclomatic-complexity 8 | `low` — patch (extract helper) | Verified: the branch pile gains two decision points. Named harm: the repo rule exists so the next editor can follow this function; extracting the lead choice keeps the touched code inside the budget without re-litigating the legacy branches. |
| Acceptance criteria were rewritten in the same diff that implements them, while memlog still calls the mapping an assumption | `false` | The user asked for the recommendation ("make a suggestion what makes more sense for which") and to work unattended; memlog carries both the `assumption` line and a later `decision` line recording the switch and its reasoning. Criteria 3 and 4 were not amended — they are the two real findings above, triaged on their own. |
| No verification evidence accompanies the change (empty triage log, no test counts) | rejected — the fix is to edit this build's plan | Counts are recorded in `## Verification` below as each run completes; nothing in the product code changes because of this row. |
| `splitImageText` fallback is not guaranteed identity-bearing when `id` is empty | `false` | `migrations/20171020203423-create-photo.js:4-8` declares `id` `allowNull: false, primaryKey: true`, and the sitemap feed is `SELECT p.* FROM "Photos" p`, so a row without an id cannot reach the helper. |
| Second pass — identity fallback always embeds the UUID, even with place and month known | `medium` — patched | Verified at `identityTitle`: `` `WiSaw ${kind}${context} ${clean(media?.id)}` `` concatenated both branches, against criterion 3's "or from the photo's identity when neither is known", and pinned by the first version of the new test. Now facts-only when known. |
| Second pass — a long place name truncated the UUID off the end, so same-city untagged photos shared one title | `medium` — patched | Verified: 14 + place + 11 + 36 exceeds `IMAGE_TITLE_MAX = 100` once `locationText()` passes ~39 characters, and `truncateWords` cuts from the end. Same root cause as the row above; both disappear with the facts-or-id rule. |
| Second pass — meta description lead still listed four tags while `og:image:title` and the title head list three, making the new code comment overstate the result | `low` — patched | Verified at `seoText.js`: `slice(0, 4)` in the lead against `slice(0, 3)` elsewhere. `TAG_TITLE_LIMIT = 3` now drives every tag slot in both stacks; contract case updated to `'In this photo: Dog, Pet, Beach'`. |
| Second pass — Plan Change Log entry described a fallback the code no longer ships | rejected — the fix is to edit this build's plan | Rewritten above; no product code involved. |

## Verification

Baseline command set from the Validation policy. Commands to run at hand-off:
1. `npx mocha --exit --require @babel/register tests/sitemap-image-text.js` — expect all new cases passing; this file did not exist before, so every case is new evidence.
2. `npx mocha --exit --require @babel/register tests/seo-crawler-contract.js` — expect the two new cases passing and the pre-existing count still passing (report the exact counts).
3. `npx mocha --exit --require @babel/register tests/inject-meta-tags.js` — expect unchanged green (byte-exact HTML untouched).
4. `npx mocha --exit tests/upload-seo-sidecar.js` and `npx mocha --exit tests/seo-sidecar-lifecycle.js` — expect unchanged green after touching the sidecar module.
5. `npx tsc -noEmit -skipLibCheck` — expect no new errors; note any pre-existing ones with their count from before the change.
6. `npx ts-standard lambda-fns/utilities/seoSidecar.ts lambda-fns/lambdas/generateSiteMap/index.ts` — expect clean.
7. `npm test` — expect only the 5 known `getSeasonBoundaries` timezone failures.

### Results (2026-11-09)

- `tests/sitemap-image-text.js`: **9 passing**, 0 failing (all new).
- `tests/seo-crawler-contract.js`: **34 passing**, 0 failing — 32 pre-existing cases plus the 2 new page-split cases (re-run after the second-pass patch).
- `tests/inject-meta-tags.js`: **39 passing**, unchanged (byte-exact HTML untouched).
- `tests/upload-seo-sidecar.js` **8 passing**; `tests/seo-sidecar-lifecycle.js` **22 passing**; `tests/comment-seo-refresh.js` **7 passing**.
- `npx tsc -noEmit -skipLibCheck`: clean — **0 errors**, same as the pre-change baseline measured before any edit.
- `ts-standard lambda-fns/utilities/seoSidecar.ts`: clean (the file lints with zero violations). `generateSiteMap/index.ts` is legacy-unformatted: 80 violations at baseline, **78** after this change — no new lint debt, none on the changed lines.
- Also re-run clean after the second-pass patch: `photo-delete-soft.js` 6, `cleanup-s3-confirm.js` 8, `redirect-canonical.js` 10 passing.
- `npm test`: **224 passing, 5 failing**, all five `getSeasonBoundaries` timezone cases recorded in this initiative's memlog as pre-existing.
