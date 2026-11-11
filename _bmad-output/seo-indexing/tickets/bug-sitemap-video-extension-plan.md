---
name: bug-sitemap-video-extension
type: "bugfix"
ticket: '5'
status: built
step: 5
created: 2026-11-10
risk: medium
lenses_ran: []
---

# Plan: the sitemap names the video file that exists

## Intent

One rule decides what a media object is called. Today three places guess it, and the one that
matters most — the sitemap generator — guesses without looking at storage, so any video not
stored as `<id>.mov` gets a sitemap entry pointing at an object that was never written while its
own page advertises a different file.

## Investigation findings

1. **The corpus today is uniform.** Bucket inventory of `wisaw-img-prod` taken 2026-11-10 with
   `aws s3api list-objects-v2 --bucket wisaw-img-prod --max-items 100000`: 43,988 `.webp`,
   21,995 `.json`, **842 `.mov`**, no other extension. So every sitemap entry resolves today;
   the defect is latent, not live. Evidence recorded in `../evidence/videos-bucket-inventory-2026-11-10.txt`.
2. **Three copies of the rule exist.** The generator hardcodes `<id>.mov`
   (`generateSiteMap/index.ts:133`) and never consults storage; the edge resolves the real object
   by listing the id prefix (`media.js`) then re-applies a second regex plus its own `.mov`
   fallback in `video.js:47`; the API model builds `<id>.mov` again (`models/photo.ts:27`). The
   generator and the head can therefore disagree for the same URL — acceptance criterion 1.
3. **The edge cannot import shared code.** The three injector functions are deployed with
   `Code.fromAsset(<the injector folder>)` — a raw zip, no bundler (`lib/resources/lambdas.ts:309`,
   `:341`, `:400`). Anything the edge loads must live inside that folder.
   Decision 2026-11-10 (Agent, for User review): the shared rule module therefore lives in
   `lambda-fns/lambdas/injectMetaTagsLambdaFunction/mediaNaming.js`, and the bundled TypeScript
   side imports it from there — one file, loaded by both builds, nothing generated or copied. The
   alternative (esbuild-bundle the edge functions so they can import from anywhere) changes how
   three Lambda@Edge functions are built and deployed; deferred as riskier than this ticket needs.
4. **Storage access is available to the generator.** `imgBucket.grantReadWrite(generateSiteMapLambdaFunction)`
   (`lib/resources/buckets.ts:87`) includes `s3:ListBucket`, and the job already holds an S3 client
   plus the bucket name (`generateSiteMap/index.ts:191`).
5. **Cost of looking.** A full-bucket list is ~45 paginated calls (~3-5 s in-region) against a
   120 s timeout, filtering to video extensions while streaming so only ~842 keys are retained.

## Actions

1. Add `mediaNaming.js` (+ `.d.ts`) in the injector folder: `VIDEO_EXTENSIONS`,
   `isVideoObjectKey(key)`, `videoObjectKey(id, resolvedKey?)`, `imageObjectKey(id)`,
   `thumbnailObjectKey(id)`, `imgUrl(key)`. Pure — no S3, no env.
2. Make `media.js` and `video.js` use it instead of their own regex and fallback string.
3. In the generator, resolve each video's key against one listing pass (`resolveVideoKeys`),
   publish `content_loc` from the resolved key, and fall back to the naming rule with a loud log
   if the listing fails — never break a working sitemap over a lookup.
4. Point `models/photo.ts` at the same rule so the API's advertised URL cannot drift again.
5. Extend `tests/sitemap-image-text.js`: a stored `.mp4` is named instead of `.mov`; an unknown
   id still gets `<id>.mov`; photo image URLs are unchanged; a failed listing falls back and still
   publishes. Add naming unit coverage for the shared module.

## Acceptance criteria mapping

- AC1 → actions 1, 2, 3. AC2 → action 3 plus the live re-check after republish (operator step).
  AC3 → action 5's unchanged-photo test. AC4 → the whole point of actions 1-4, with the inventory
  evidence from finding 1 attached either way.

## Boundaries (unchanged from the ticket)

Same URL set; no thumbnail-rule rework; no client app changes. `lib/` untouched — no IAM or
construct changes were needed.

## Validation policy

- `npx mocha --exit tests/sitemap-image-text.js tests/inject-meta-tags.js tests/media-naming.js`
  (baseline before this change: the two existing suites pass; there is no `tests/media-naming.js`).
- Full suite afterwards: `npm test` — baseline 245 passing with 5 pre-existing
  `getSeasonBoundaries` timezone failures.
- Lint: `HOME="$TMPDIR" npx ts-standard lambda-fns/lambdas/injectMetaTagsLambdaFunction/mediaNaming.js
  lambda-fns/lambdas/generateSiteMap/index.ts` — baseline clean for those files.

## Verification

- `npx mocha --exit tests/media-naming.js tests/sitemap-image-text.js` → 21 passing (8 new naming
  tests, 4 new sitemap resolution tests).
- `npx mocha --exit tests/inject-meta-tags.js tests/seo-crawler-contract.js` → 94 passing, unchanged.
- Full suite `npm test` → 257 passing, 5 failing: the same pre-existing `getSeasonBoundaries`
  timezone failures (baseline 245 + 12 new).
- Lint on the touched files: injector JS and both test files clean; `generateSiteMap/index.ts` +
  `models/photo.ts` report 70 problems against a baseline of 71 for the same two files — no new debt.
- Caught while testing: the first draft of `thumbnailObjectKey` produced `<id>--thumb.webp`. The
  injector suites assert that URL, which is how it was found before anything shipped.

## Acceptance criteria

- [x] AC1 — a stored `.mp4` is named by the sitemap and matches the head: both call
  `pickVideoObjectKey`/`videoObjectKey`, pinned by `tests/sitemap-image-text.js`.
- [x] AC2 — no entry names a missing object, because the generator now publishes what storage
  reported; the live re-check of the first hundred entries is the operator step below.
- [x] AC3 — photo image URLs unchanged, asserted against the pre-change spelling in both suites.
- [x] AC4 — one rule answers generator and head (`mediaNaming.js`), *and* the bucket inventory that
  would have justified "no change needed" is attached: `../evidence/videos-bucket-inventory-2026-11-10.txt`.

## Operator step after deploy

Republish the sitemap (`generateSiteMap` runs every 5 min in prod) and re-request the first hundred
video file URLs; the run logs `stored video keys: <n>` and warns with `unresolvedVideos` when an id
has no stored object, so a disagreement is visible instead of silent.

## Open questions

- Does the upload path (mobile app) ever write a non-`.mov` video? The corpus says no so far; the
  edge's own comments assume it can happen, which is why resolution stays live rather than removed.
