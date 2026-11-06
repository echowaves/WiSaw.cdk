**Area `lambda-fns/` @ 3813371** — digest

**Q1 — SEO injection for `/photos/<uuid>` and `/videos/<uuid>` at the edge (request → response)**
- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/photo.js:13 exports.handler @ 3813371` — origin-request handler: parses URI, parallel sidecar+media fetch, 404/noindex branches, injects, returns.
- `…/photo.js:20 !parsed.valid` and `:34 !media.exists` — the two 404+`noindex` exits (malformed id; definitively-missing media).
- `…/video.js:13 exports.handler @ 3813371` — same flow for videos; adds duration and real media key.
- `…/video.js:47 mediaKey` — og:video/VideoObject.contentUrl uses the actual S3 key, not an assumed `.mov`.
- `…/mediaUri.js:23 parseMediaUri @ 3813371` — canonical `/photos|videos/<uuid>` gate (lower-case, strips `/full`,`/thumb`, trailing slash); `:42 needsCanonicalRedirect` for the 301 side.
- `…/sidecar.js:57 fetchSidecar @ 3813371` — reads `seo/<id>.json` from `WISAW_IMG_BUCKET` (edge cannot reach Postgres), in-memory TTL cache.
- `…/media.js:28 probeMedia @ 3813371` — existence/freshness via `ListObjectsV2` prefix; only an empty listing counts as gone.
- `…/media.js:56 readDuration @ 3813371` — S3 user-metadata duration for videos.
- `…/seoText.js:59 buildSeoFields @ 3813371` — sidecar → pageTitle/metaDescription budgeted against place+month.
- `…/template.js:29 fetchShell @ 3813371` — cached S3 `wisaw.com/index.html` shell + `:20 fallbackShell`.
- `…/utils.js:160 injectMetaTags @ 3813371` — strips old og/twitter tags, rewrites title/canonical, inserts meta block.
- `…/utils.js:79 buildSeoBody @ 3813371` + `:68 renderRootBody @ 3813371` — crawler-visible `<div id="root">` body incl. JSON-LD; `:51 renderNotFoundDocument`, `:247 htmlResponse` (X-Robots-Tag, cache-control).
- `…/static.js:54 exports.handler @ 3813371` — sibling behaviour for `/`,`/about`,`/contact`,`/terms`,`/search` (`:11 ROUTES`, `:44 routeFor`).
- `lambda-fns/lambdas/redirectLambdaEdgeFunction/index.js:34 mediaMatch @ 3813371` — viewer-request 301 consolidator (case, trailing slash, integer→UUID).
- `lambda-fns/lambdas/imgRedirectLambdaEdgeFunction/index.js:2 exports.handler @ 3813371` — marked `// unused`.

**Q2 — `seo/*.json` sidecars: creation, publication, reads**
- `lambda-fns/utilities/seoSidecar.ts:99 buildSeoSidecar @ 3813371` — the only builder (v, caption, labels, created, location, width, height); `:115 sidecarKey` = `seo/<lower-id>.json`; `:19 SEO_SIDECAR_VERSION`.
- `…/seoSidecar.ts:85 assertNoPreciseLocation @ 3813371` (`:66 PRECISE_KEYS`, `:69 isPreciseLocation`) — writer refuses coordinates; header comment `:4` states the contract with the edge reader.
- `…/seoSidecar.ts:119 putSeoSidecar @ 3813371` / `:133 putSeoSidecars @ 3813371` — PutObject, `CacheControl: max-age=60`, bounded concurrency.
- `…/seoSidecar.ts:152 deleteSeoSidecar @ 3813371` — idempotent removal; `:161 SEO_WATERMARK_KEY = 'seo/_last-run.json'`, `:169 readSeoWatermark`, `:183 seoWindowStart`, `:190 writeSeoWatermark`.
- `lambda-fns/lambdas/generateSiteMap/index.ts:28 publishSidecars @ 3813371` — watermark window → `recentlyTouched` (`:17`) → batch PUT; watermark advanced only when `written > 0 && failed === 0`.
- `…/generateSiteMap/index.ts:189 try` block, `:196 publishSidecars(...)` — called from the scheduled sitemap job; `:195 event?.backfill === true` one-off full pass (`:15 BACKFILL_CONCURRENCY`).
- `…/injectMetaTagsLambdaFunction/sidecar.js:57 fetchSidecar @ 3813371` — reader; `:35 stripPreciseLocation` re-drops coordinates on read (legacy objects), `:44 remember` cache eviction.
- `…/sidecar.js:9 SIDECAR_TTL_MS @ 3813371` and header `:4` — why the edge reads S3 rather than Postgres.
- `lambda-fns/lambdas/processDeletedImage/index.ts:68 _deleteSidecar @ 3813371` — retire path (see Q3).

**Q3 — photo deletion lifecycle (user request → DB row → S3)**
- `lambda-fns/index.ts:269 deletePhoto @ 3813371` — GraphQL mutation entry, args `[photoId, uuid]`.
- `lambda-fns/controllers/photos/delete.ts:7 main @ 3813371` — frozen-wave check (`:15 frozenCheck`, owner override), then `:35 UPDATE "Photos" SET "active" = false` — soft delete only; no S3 call.
- `…/controllers/photos/delete.ts:42 waveResult` → `lambda-fns/controllers/waves/_updatePhotosCount.ts:4 _updatePhotosCount @ 3813371` — recount filters `"active" = true`.
- `lambda-fns/lambdas/processDeletedImage/index.ts:9 main @ 3813371` — S3 ObjectRemoved trigger (`:12 record.s3.object.key`, `:17` strips `-thumb`/`.webp`); fans out to `_deleteUpload`/`_deleteSidecar`/`_cleanupTables`.
- `…/processDeletedImage/index.ts:37 _deleteUpload @ 3813371` — DeleteObject of the original key in the event's bucket.
- `…/processDeletedImage/index.ts:68 _deleteSidecar @ 3813371` — deletes `seo/<id>.json`, errors swallowed by design (`:64` comment).
- `…/processDeletedImage/index.ts:84 _cleanupTables @ 3813371` — hard row deletes in FK order: WavePhotos (`:96`) + count refresh, Watchers (`:110`), Recognitions (`:120`), Comments (`:130`), Photos (`:141`).
- `lambda-fns/lambdas/processUploadedImage/index.ts:63 _deleteUpload/_activatePhoto @ 3813371` — upload lifecycle counterpart (deletes the `<id>.upload` key, activates row); `:196 _deleteUpload`.
- Gap surfaced by search: nothing in this area deletes media or the sidecar on the user path — hard delete depends on an S3 object removal event raised outside `lambda-fns/`.

**Q4 — `scripts/cleanup-s3.js` classification/deletion of keys**
- Nothing in this area implements or calls it. Closest key-classification code found: `…/injectMetaTagsLambdaFunction/media.js:28 probeMedia @ 3813371` (prefix listing, `:13 VIDEO_EXT_RE`, `:36` thumb/original preference) and `…/mediaUri.js:14 SUFFIX_RE @ 3813371`; deletion-side key building is only `lambda-fns/utilities/seoSidecar.ts:115 sidecarKey @ 3813371` and `…/processDeletedImage/index.ts:17 photoId` normalization.

**Q5 — how tests pin the edge behaviours and sidecar lifecycle**
- `…/injectMetaTagsLambdaFunction/sidecar.js:84 module.exports @ 3813371` — comment states `isPreciseLocation`/`stripPreciseLocation` are exported *for* `tests/seo-crawler-contract.js`; `:85` says the coordinate guarantee "has to be pinned by a test".
- `lambda-fns/utilities/seoSidecar.ts:6 header comment @ 3813371` — same contract: `tests/seo-crawler-contract.js` pins the fields the edge reader consumes; both sides must change in one commit.
- Test-facing seams visible from here: pure exported helpers (`utils.js:309 module.exports`, `mediaUri.js:50`, `seoText.js:116`, `template.js:52 fallbackShell`) and env-overridable buckets (`photo.js:10 IMG_BUCKET`, `sidecar.js:15 bucketName`).

**Q6 — why string concatenation, byte-exact HTML matching, `DEPLOY_ENV=prod` gate**
- Byte-exact matching rationale is in-code: `…/utils.js:217 canonical rewrite comment @ 3813371` — the old single literal (`<link rel="canonical" href="https://wisaw.com" data-rh="true"/>`) missed the deployed template (`rel='canonical'`, single quotes, space before `/>`); the silent miss pointed ~22k pages' canonical at the homepage and they were dropped as duplicates. Hence the tolerant pattern `:223 canonicalPattern` + inject-if-absent `:225`.
- Same class of failure documented at `…/mediaUri.js:4 parseMediaUri header @ 3813371` (duplicate self-canonicalising URLs), `…/utils.js:30 stripExistingMetaTags comment @ 3813371` (attribute-order-dependent pattern left a duplicate description), `…/template.js:4 fetchShell header @ 3813371` (one unguarded GetObject turned ~21k URLs into edge 5xx), `…/media.js:6 probeMedia header @ 3813371` (false-negative 404s de-index live pages).
- String concatenation: no in-code explanation. History evidence only — `625562a` and `f18a623`, both "refactor: replace template literals with string concatenation in injectMetaTags function", both touching only `…/utils.js`; the convention is applied to `injectMetaTags` (`utils.js:198-235`) while `buildSeoBody` still uses template literals (`utils.js:104-156`).
- `DEPLOY_ENV=prod`: no evidence in this area (gate lives outside `lambda-fns/`).

**Searched, found nothing (all at 3813371)**
- `git grep -n -i "DEPLOY_ENV" … -- lambda-fns` — no prod gate or mention.
- `git grep -n -i "template literal|concatenat|edge runtime" … -- lambda-fns` — no comment explaining the concatenation/edge-runtime constraint.
- `git grep -n -i "cleanup-s3|cleanupS3" … -- lambda-fns` and `-i "orphan"` — only the `_deleteSidecar` comment at `processDeletedImage/index.ts:64`; no reference to `scripts/cleanup-s3.js`.
- `git grep -n "tests/|mocha" … -- lambda-fns` — only the two `tests/seo-crawler-contract.js` mentions (`sidecar.js:84`, `seoSidecar.ts:6`); no mention of `tests/inject-meta-tags.js`; `git ls-tree -r --name-only … -- lambda-fns | grep -iE "test|spec"` → none.
- `git grep -n "DeleteObject" … -- lambda-fns` — only `processDeletedImage/index.ts:48`, `seoSidecar.ts:153`, `processUploadedImage/index.ts:206`; no S3 delete reachable from `controllers/photos/delete.ts`.
- `git grep -n "deletedAt|isDeleted" … -- lambda-fns` — none (soft delete is `"active" = false`).
- `git grep -n "duration|Metadata" … -- lambda-fns/lambdas/processUploadedImage` — no writer for the `duration` S3 metadata that `media.js:56 readDuration` reads; likewise `seoText.js:112` reads `sidecar.duration`, which `buildSeoSidecar` (`seoSidecar.ts:101`) never writes.
- `git grep -n "putSeoSidecar|buildSeoSidecar" … -- lambda-fns` — only `generateSiteMap/index.ts:38`; the comment path referenced at `seoSidecar.ts:96` has no writer here.