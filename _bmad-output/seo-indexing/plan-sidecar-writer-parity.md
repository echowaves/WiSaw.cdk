---
title: 'One sidecar write path for the CLI, the trigger, the schedule and the edge'
type: 'refactor'
ticket: ''
created: '2026-11-15'
status: 'built'
baseline_revision: '86e9d78a4c6fdd35b3c1cee43a01169151befd9c'
route: 'oneshot'
route_source: 'pinned'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: ['_bmad-output/seo-indexing/plan-edge-skeleton-correctness.md', '_bmad-output/plan-seo-sidecar-lifecycle.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Four writers publish the `<id>.json` sidecar and each spells the same three facts out differently. The bucket: the comment path reads `S3_BUCKET` (the only variable the stack actually passes, via `...config`), the 5-hourly job reads `S3_IMAGES_BUCKET || 'wisaw-img-prod'`, the operator backfill reads `S3_IMAGES_BUCKET || wisaw-img-<env>`, the upload trigger takes it from the S3 event, and the edge reader reads a fourth name (`WISAW_IMG_BUCKET`) that **no deployment ever sets** — both Lambda@Edge functions have their `environment` block commented out in `lib/resources/lambdas.ts`, so today the injector resolves the media bucket by falling through to a hardcoded production name. The row: `PHOTO_SEO_QUERY` is exported and reused by `populate-video-durations.js`, yet `scripts/publish-seo-sidecars.js` and `generateSiteMap/index.ts` each carry their own verbatim copy of the labels-LATERAL statement — that is how "duration" went missing from one writer for months. The gaps: the CLI publishes a video with no duration because nothing teaches it to measure one; `populate-photo-dimensions.js` writes `width`/`height` without moving `updatedAt`, so backfilled sizes stay outside the job's touch window and never reach a page; and no test anywhere executes the scheduled writer's PUTs — its SQL text is grepped, its S3 calls are not made.

**Approach:** One resolver for the bucket, one exported query for the row, one learning step shared by every writer that can meet an unmeasured video. Wire `WISAW_IMG_BUCKET` into both edge functions so the injector reads a real value instead of a fallback, and keep the raw-zip edge folder's tiny local reader pinned to the TypeScript resolver by test (it cannot import it — the folder is deployed as a zip with no bundler). Make the CLI do what the trigger does: learn missing durations through `learnVideoDurations`, then publish. Give the scheduled writer the test its own code never had.

## Boundaries

- No change to what a sidecar **contains** (`buildSeoRecord` / `SEO_SIDECAR_VERSION` untouched) and no republish of the corpus: publishing is the operator's command, never run here.
- No AWS-mutating commands, no `cdk deploy`. `lib/resources/lambdas.ts` changes are code + a pin only; the human runs the deploy.
- The edge folder stays plain CommonJS with no imports from outside its directory (raw `Code.fromAsset`, see the note in `mediaNaming.js`).
- Nothing here unblocks brief §9 C4 (G4): that needs a readable sidecar path plus a republished corpus, and is recorded as blocked in the client's deferred work.

## I/O matrix

| Input | Current answer | Required answer |
|---|---|---|
| Any writer, `S3_BUCKET` set, nothing else | comment path writes there; job/CLI write to a name derived elsewhere | every writer resolves the same bucket from the same precedence |
| Writer with no bucket variable at all | job silently targets `wisaw-img-prod`; CLI targets `wisaw-img-<env>` | resolver throws with the variable names in the message — no silent production default |
| Edge injector, deployment as of today | `WISAW_IMG_BUCKET` unset → hardcoded prod fallback | `WISAW_IMG_BUCKET` supplied by the stack from `config.S3_BUCKET`; fallback kept only for the case where the edge has no env at all, and logged |
| Video row with no duration, operator backfill | published without a duration; nothing measures it until a comment or the bounded scheduled pass | CLI learns it through `learnVideoDurations` (measure from the container, persist via `STORE_DURATION_SQL`) and publishes the measured value |
| `populate-photo-dimensions.js` writes sizes | row changes, `updatedAt` unchanged → outside the touch window forever | same UPDATE also moves `updatedAt`, so the next scheduled run republishes that page |
| CLI dry run | prints `written=N` for objects it never wrote | prints `wouldWrite=N` |
| Scheduled job's PUTs | untested (SQL text only) | a test runs the real `main()` and asserts `<lower-id>.json` PUTs into the resolved bucket with the sidecar content type and cache headers |

## Resolved Decisions

- Edge bucket source → **wire the environment** (human, 2026-11-15): both edge functions get `WISAW_IMG_BUCKET` from `config.S3_BUCKET`, so one variable names one bucket everywhere; the deploy is the human's command.
- CLI durations → **reuse `learnDurationForId`/`learnVideoDurations`**, persisting through the existing `STORE_DURATION_SQL`, exactly as the upload trigger and the scheduled job do — no second measuring path, no read-only variant.
- Backfilled sizes → **bump `updatedAt`** rather than have the script PUT sidecars itself: one writer path stays responsible for publishing, and the touch window (which already exists) does the rest.

</frozen-after-approval>

## Implementation Notes

Highest-risk item is T2 (the edge environment), because a wrong bucket name means the injector reads sidecars from the wrong corpus — which fails as "pages lost their text", the exact class of silent SEO damage this repo has been bitten by twice. That is why it comes with a pin that reads `lib/resources/lambdas.ts` and asserts both edge functions receive the variable, and why the reader keeps logging when it has to fall back. Everything else removes duplication rather than adding behaviour.

## Code Map

| File | Role here |
|---|---|
| `lambda-fns/utilities/sidecarBucket.ts` (new) | `seoSidecarBucket()` — one precedence, throws with the names it looked for |
| `lambda-fns/lambdas/generateSiteMap/index.ts` | resolver + shared query; drop its bucket fallback and its copy of the SQL |
| `lambda-fns/controllers/photos/_updateSeoSidecar.ts` | keeps exporting the row query (now defined in the shared module); resolver instead of its own `S3_BUCKET` read |
| `scripts/publish-seo-sidecars.js` | shared query, shared resolver, duration learning, honest dry-run counts |
| `scripts/populate-photo-dimensions.js` | `updatedAt` in the UPDATE |
| `lambda-fns/lambdas/injectMetaTagsLambdaFunction/{sidecar,photo,video}.js` | one `imgBucket()` inside the zip folder, used by all three; fallback logged |
| `lib/resources/lambdas.ts` | `environment: { WISAW_IMG_BUCKET: config.S3_BUCKET }` on both edge functions |
| `tests/seo-sidecar-lifecycle.js`, `tests/sitemap-image-text.js`, `tests/static-route-copy-once.js` | writer parity, scheduled PUTs, wiring pin |

## Tasks

- [x] **T1 One bucket resolver.** New `lambda-fns/utilities/sidecarBucket.ts`: trim `S3_IMAGES_BUCKET ?? WISAW_IMG_BUCKET ?? S3_BUCKET`; empty after trimming → throw naming all three. Use it in `generateSiteMap`, `_updateSeoSidecar` (replacing its warn-and-skip) and both scripts that write sidecars.
- [x] **T2 Wire the edge, and pin the wiring.** Both `injectMetaTagsLambdaFn-{photo,video}` definitions get an `environment` block carrying `WISAW_IMG_BUCKET: config.S3_BUCKET`. Inside the zip folder add one `imgBucket()` (in `sidecar.js`, exported) that reads the same variable and logs once when it must fall back; `photo.js`/`video.js` use it instead of their own module-level constant. Pin in a test that `lib/resources/lambdas.ts` passes the variable to both edge functions, so the wiring cannot rot silently.
- [x] **T3 One row shape, one query.** Move the labels-LATERAL statement into the shared module as `PHOTO_SEO_QUERY` (+ `photoSeoQuery({ limit })` for the backfill's bounded form) and have `_updateSeoSidecar`, `publish-seo-sidecars.js` and `generateSiteMap` import it. Assert in a test that no second copy of the statement survives in the repo (`LATERAL` appears once outside tests).
- [x] **T4 The backfill learns durations.** In `publish-seo-sidecars.js`, run `learnVideoDurations(rows, { bucket, client })` over the fetched rows before publishing and pass the learned rows on, so a video measured by this run publishes its length in the same pass — the behaviour the trigger and the job already have.
- [x] **T5 Honest dry-run counts.** Report `wouldWrite` instead of `written` when `--dry-run`; keep `failed` meaning the same thing in both modes.
- [x] **T6 Backfilled sizes reach pages.** Add `"updatedAt" = NOW()` to the UPDATE in `populate-photo-dimensions.js`, with a comment saying why (the scheduled job selects by touch window).
- [x] **T7 Test the writer nobody tests.** In `tests/sitemap-image-text.js`'s existing harness (real `main()`, stubbed psql + `S3Client.prototype.send`), feed rows touched inside the window and assert the sidecar PUTs: key `<lower-id>.json`, resolved bucket, `ContentType: application/json`, and the cache header the writer sets.

## Verification

- `npx mocha --exit --require @babel/register tests/seo-sidecar-lifecycle.js tests/sitemap-image-text.js tests/upload-seo-sidecar.js tests/video-duration.js tests/comment-seo-refresh.js tests/static-route-copy-once.js tests/edge-detail-truthfulness.js` — every new pin confirmed to fail on the pre-change tree.
- `npm test`: only the 5 documented `getSeasonBoundaries` timezone failures may fail.
- `HOME="$TMPDIR/lint-home" npx ts-standard --no-cache <touched files>`: clean (the repo-wide `npm run lint` cache write needs a writable HOME).
- Not runnable here and therefore handed over: the deploy that sets the edge environment, then `curl -sSI https://img.wisaw.com/<id>.json` on a test-environment id to confirm the injector and the writers agree on one bucket.

## Implementation Notes

Built as written, with three deviations worth recording.

- **One resolver, no new file.** `seoSidecarBucket()` went into `lambda-fns/utilities/seoSidecar.ts`, which every writer already imports, instead of a new `utilities/sidecarBucket.ts`. A second module for one function only gives callers two places to look.
- **The row query is a builder over a shared projection, not a copy of `PHOTO_SEO_QUERY`.** The three callers do not read the same rows: one id (`$1`), the newest 30k by touch, and a bounded backfill slice. What they must never disagree about is the projection and the label aggregation, so `utilities/seoPhotoRow.ts` exports `SEO_ROW_SELECT` plus `seoRowQuery({ where, orderBy, limit })`, and `PHOTO_SEO_QUERY` is now that builder's single-row form. The plan's `photoSeoQuery({ limit })` was the same idea with a less honest shape: it implied callers could differ only by cap.
- **The edge needed a fallback the writers must not have.** Lambda@Edge receives no configuration channel here, so `bucket.js` in the injector folder reads `WISAW_IMG_BUCKET` and, when absent, names production *and logs it once per container*. The writers' resolver throws instead - a writer that guesses publishes into a corpus nobody reads.
- **Scope grew by one script.** `scripts/populate-video-durations.js` PUTs sidecars too, so it now resolves its bucket the same way; leaving it deriving `wisaw-img-<env>` would have kept the exact drift this goal exists to remove. The pin that proves it is derived from what the scripts do (any file in `scripts/` that calls `putSeoSidecar(`) rather than from a list of names, so the next sidecar writer is covered the day it appears.
- **A new escape hatch.** Duration learning in the backfill can cost tens of thousands of S3 probe sequences; `--skip-duration-learning` lets an operator publish text now and lengths later, mirroring `populate-video-durations.js`'s own `--skip-sidecars`.

Caught by the new scheduled-writer test, not by reading: removing the job's own bucket constant left a stale `imgBucketName` argument at the sidecar call, and because that call sits inside its own `try/catch`, the `ReferenceError` was logged as "Unable to publish SEO sidecars" while the sitemap still published - i.e. exactly the silent loss of every page's text this goal is meant to make impossible. The test fails loudly on it (`tests/sitemap-image-text.js`).

## Review Triage Log (quick lens)

| # | Finding | Verdict |
|---|---|---|
| 1 | `learnVideoDurations` persists through `lambda-fns/psql.ts`, whose connection is built from `process.env` at import time; the backfill's env file is loaded later. A lazy `require` fixes the ordering only if `.env.<env>` mutates `process.env` rather than returning a parsed object. | **Open, needs one operator run.** If it does not, the probe results still reach the sidecars (they are set on the rows in memory) and only the persistence logs `storing learned durations failed`, so no page is wrong; verify with `node ./scripts/publish-seo-sidecars.js test --limit=5` and check that line is absent. |
| 2 | `seoRowQuery` interpolates caller-supplied SQL fragments. | Rejected as a finding: all three call sites pass literals, the limit is coerced to an integer, and there is no user input on this path. Documented in Design Notes so a future caller does not forget. |
| 3 | `cleanup-s3.js`, `populate-photo-dimensions.js` and `populate-recognitions.js` still derive `S3_BUCKET \|\| wisaw-img-<env>`. | Deliberately deferred, recorded in `seo-indexing/deferred-work.md`: those scripts never write a sidecar, and `cleanup-s3.js` **deletes** objects - changing which bucket it targets on an environment where `S3_IMAGES_BUCKET` is set to something else is a bigger decision than this goal's boundary allows. |
| 4 | The edge folder keeps a second copy of the bucket rule (`bucket.js`). | Rejected as duplication: the folder is deployed with `Code.fromAsset` and cannot import outside itself (same constraint as `mediaNaming.js`). Pinned instead - one file in that folder may name the variable, and both sides must use the same name. |
| 5 | A misconfigured stack now logs the resolver's message three times per scheduled run (listing, duration learning, sidecars). | Kept: three loud failures beat one swallowed failure, and the alternative is branching `main()` further. |
| 6 | **Real defect, found by the deploy:** the edge environment wiring in T2 fails synth with `LambdaEdgeEnvironmentVariablesNotAllowed`, blocking every deploy from this branch. | Fixed as described above (generated constant), with `tests/edge-bucket-config.js` pinning both halves and a rewritten pin that forbids an env block on either injector function, so the shape cannot come back quietly. |

## Renegotiated during build: the edge cannot be given an environment

The decision above said "wire `WISAW_IMG_BUCKET` into both edge functions". Implemented that way, and
the real deploy rejected it:

> LambdaEdgeEnvironmentVariablesNotAllowed — The function prod-WiSawCdkStack/prod_injectPhotoMetaTagsLambdaFunction_photo/Fn contains environment variables [WISAW_IMG_BUCKET] and is not compatible with Lambda@Edge.

That is why every edge function in `lib/resources/lambdas.ts` has had its `environment` block commented
out since long before this work: Lambda@Edge allows none, and the suggested `removeInEdge` escape hatch
only *deletes* the variable at the edge - which is exactly where the injector needs it. Manual checks
step 2 anticipated this outcome, so the wiring switched to the recorded fallback (option 2 of that
decision): `lib/utilities/edgeMediaBucket.ts` writes `bucket.gen.js` into the injector's own asset
folder during synth, from `config.S3_BUCKET`, and the folder's reader prefers a real
`WISAW_IMG_BUCKET` (dev/test only), then the generated constant, then production - logged.

Verified locally against the installed aws-cdk-lib rather than assumed: a probe distribution with an
origin-request `EdgeFunction` that declares one environment variable fails synth with exactly the error
above; the same construct with no variables synthesizes. The check is `Object.keys(environment).length
!== 0` in `aws-lambda/lib/function.js`, so any env var on either injector function reproduces it.

## Design Notes

- **Precedence** `S3_IMAGES_BUCKET` → `WISAW_IMG_BUCKET` → `S3_BUCKET`, decided 2026-11-15: most specific override first, down to the one variable the stack spreads from `.env.<env>`. No default anywhere on the writer side.
- **Why the edge differs.** The writers throw; the injector falls back and logs. A reader that throws would return a 500 for every page in the distribution, so it degrades toward "renders with no enrichment" and says so once per container (`resetFallbackWarning()` exists only because a test suite is one long-lived container).
- **`seoRowQuery` accepts SQL fragments, not parameters.** Every fragment is code-authored; nothing user-supplied reaches it. A caller that ever wants a value inside the predicate must pass a `$n` placeholder and supply values to `psql.query` separately - the builder never inlines data.
- **Duration learning stays "measure and persist"** (`learnVideoDurations`), matching the trigger and the scheduled job, per the decision above; the CLI does not get a read-only variant, so a measured video is measured once for the life of the row no matter which writer found it.

## Manual checks (operator, after deploy)

1. `cdk deploy` for one non-production stack — synth now writes `lambda-fns/lambdas/injectMetaTagsLambdaFunction/bucket.gen.js` (gitignored) with that stack's `S3_BUCKET`; confirm the deployed function's code contains it, then `curl -sSI "https://img.wisaw.com/<id>.json"` and check the injector's CloudWatch logs for no fallback line (`no WISAW_IMG_BUCKET and no generated bucket constant`).
2. A stale `bucket.gen.js` from a previous synth is rewritten on every synth and only changes the asset hash when the value changes, so nothing to clean up - but never commit it.
3. `node ./scripts/publish-seo-sidecars.js test --limit=5` and confirm `⏱ durations:` reports learned counts with no `storing learned durations failed` line (triage finding 1).
4. `npm run populate-dimensions -- prod` on a small slice, then confirm the next scheduled run republishes those pages' sidecars (the `updatedAt` bump is what makes that happen).
