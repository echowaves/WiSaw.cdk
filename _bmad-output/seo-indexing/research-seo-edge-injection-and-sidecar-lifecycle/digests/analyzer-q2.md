## Digest — how `seo/*.json` sidecars are created, published, and read @ 3813371

### Shape (created)
- A sidecar is one small JSON object per photo/video: `{v, caption, labels, created, location, width, height}` — lambda-fns/utilities/seoSidecar.ts:21 `SeoSidecar` @ 3813371. **Load-bearing.**
- Built only through the shared builder: lambda-fns/utilities/seoSidecar.ts:99 `buildSeoSidecar` @ 3813371 — caption from `lastComment` sliced to 200 (:103), labels via :36 `pickLabels` (cap 8), `created` ISO or empty string (:106), location via :55 `locationText` from address columns only (:16-:17 header comment). Version constant `SEO_SIDECAR_VERSION = 1` (:19) written as `v` (:102).
- Rationale for the split is in the file header: Lambda@Edge cannot join the VPC to reach Postgres — lambda-fns/utilities/seoSidecar.ts:4-:6 @ 3813371, repeated at lambda-fns/lambdas/injectMetaTagsLambdaFunction/sidecar.js:4-:8 @ 3813371.
- Key contract: `seo/<lowercased-id>.json` — lambda-fns/utilities/seoSidecar.ts:115 `sidecarKey` @ 3813371. Run watermark is a sibling object `seo/_last-run.json` — :161 `SEO_WATERMARK_KEY` @ 3813371.

### Publisher A — scheduled sitemap job (writes + watermark)
Call stack, lambda-fns/lambdas/generateSiteMap/index.ts @ 3813371:
- :51 `main` → :189 try block (sidecar path isolated from the sitemap PUT; failure logged only at :197-:199) — bucket `process.env.S3_IMAGES_BUCKET || 'wisaw-img-prod'` (:190), `backfill = event?.backfill === true` (:195)
  - :28 `publishSidecars` → :30 `readSeoWatermark` (skipped when backfill) → :31 `seoWindowStart` → :32 `recentlyTouched` filter (:17, by `updatedAt >= windowStart`) → :35 early return on zero candidates → :38 `putSeoSidecars`
    - lambda-fns/utilities/seoSidecar.ts:133 `putSeoSidecars` @ 3813371 — chunked `Promise.allSettled`, counts `{written, failed}` (:137-:145)
      - :119 `putSeoSidecar` @ 3813371 — PutObject, `ContentType: 'application/json'`, `CacheControl: 'max-age=60'` (:124-:127); body from `buildSeoSidecar` (:123)
  - :43-:44 watermark advanced only when `written > 0 && failed === 0`; otherwise old watermark kept so the window is retried — **load-bearing**
- Concurrency: 20 incremental (:12 `SIDECAR_CONCURRENCY`) vs 60 backfill (:15 `BACKFILL_CONCURRENCY`), chosen at :37. Feed is `ORDER BY p."updatedAt" DESC LIMIT 30000` (:89-:90); backfill therefore converges newest-first and re-invocation is safe (:191-:194).
- Trigger/limits in infra: lambda-fns function defined at lib/resources/lambdas.ts:229 @ 3813371, `timeout: 120s` with the sidecar-work comment at :246-:248, EventBridge rule `lambda-polling-rule` every 5 hours at :261-:263 (target carries no payload → scheduled runs are incremental; `backfill: true` only reaches it by manual invoke).
- Empty photo feed aborts before any write, so a failed query publishes nothing — generateSiteMap/index.ts:106-:110 @ 3813371.

### Publisher B — one-off backfill script (same purpose, unranked with A)
- scripts/publish-seo-sidecars.js:4-:20 @ 3813371 states it exists to enrich the ~21k already-indexed URLs at once and that it mirrors `buildSeoSidecar`.
- Own copy of every helper: :74 `clean`, :76 `pickLabels`, :93 `locationText`, :103 `isPreciseLocation`, :113 `buildSidecar` with `v: 1` hardcoded (:116, comment says keep in step with `SEO_SIDECAR_VERSION`).
- Bucket: `process.env.S3_IMAGES_BUCKET || wisaw-img-<env>` — :68 @ 3813371. SQL selects address columns and deliberately omits `p."location"` — :150 `QUERY` (:148-:149 comment), `ORDER BY p."createdAt" DESC`, optional `LIMIT` (:177-:178).
- PUT loop: :198-:219 @ 3813371 — batches (`--batch-size` default 200, `--concurrency` default 16, :70-:72), `Promise.allSettled`, key literal `seo/${row.id}.json` (:210) rather than `sidecarKey()`, same `CacheControl: 'max-age=60'` (:213). `--dry-run` prints instead of PUTting (:204-:207). Exports for tests at :231.
- Entry points: package.json:21 `seo-sidecars`, :22 `seo-sidecars:dry-run` @ 3813371.

### Deletion / pruning
- On S3 `OBJECT_REMOVED` filtered to `-thumb.webp` (lib/resources/buckets.ts:51-:57 @ 3813371), lambda-fns/lambdas/processDeletedImage/index.ts:24 `_deleteSidecar` runs in parallel with media/table cleanup and calls utilities/seoSidecar.ts:152 `deleteSeoSidecar`; errors are swallowed by design — processDeletedImage/index.ts:68-:82 @ 3813371.
- Orphan reconciliation: scripts/cleanup-s3.js:19 `SIDECAR_KEY_RE` (strict lowercase UUID) and :33 `classifyKey` → keep/delete; `seo/_last-run.json` and malformed keys are report-only, never deleted (:31-:32, :159).

### Reading
- Edge reader: lambda-fns/lambdas/injectMetaTagsLambdaFunction/sidecar.js:57 `fetchSidecar` @ 3813371 — key `seo/${id}.json` (:61), in-memory Map cache TTL 10 min (:11, hit test :63), FIFO eviction at 500 entries (:44 `remember`, :12), S3 `GetObject` against `process.env.WISAW_IMG_BUCKET || 'wisaw-img-prod'` in us-east-1 (:15-:17, :66-:69); a miss/error caches and returns `null` so the page renders un-enriched (:73-:81). **Load-bearing.**
- Id casing lines up: reader gets the id already lowercased by mediaUri.js:32 @ 3813371 (via photo.js:24 / video.js:21 `sanitizeImageId`), matching `sidecarKey()`'s lowercasing.
- Consumers: photo.js:26-:29 and video.js:23-:26 fetch the sidecar in parallel with media probing, then pass it to seoText.js:59 `buildSeoFields`, which reads `caption`/`labels`/`location` (:62-:65) and `created` (:66, falling back to S3 `LastModified`), plus `width`/`height` (:110-:111). The script writer's keys are the same set.
- IAM/path plumbing: media-bucket write grant for the publisher — lib/resources/buckets.ts:69-:73 @ 3813371 (comment names `seo/<id>.json`); injector read grants at :78 and :83 (`grantReadWrite`, though the reader only issues GetObject).

### Checks on the path that reject or throw
- utilities/seoSidecar.ts:86-:89 `assertNoPreciseLocation` — throws `refusing to publish a sidecar with a coordinate field: <key>` for any top-level key in `PRECISE_KEYS` (:66).
- utilities/seoSidecar.ts:90-:92 — throws `…location is a coordinate, not a place name` when `isPreciseLocation(body.location)`; :69 `isPreciseLocation` rejects objects (Sequelize/Point), `POINT(...)`, WKB/EWKB hex `^0[01][0-9A-Fa-f]{16,}$`, and decimal lat/lon pairs (:72-:79). Free-text caption/labels are intentionally not scanned (:64-:65).
- scripts/publish-seo-sidecars.js:124-:127 `buildSidecar` — same coordinate-key throw (lists all offenders); :128-:130 — same coordinate-location throw.
- scripts/publish-seo-sidecars.js:40-:54 `loadEnvConfig`/`fail` — exits 1 for missing env name, unknown environment, or missing `.env.<env>`.
- generateSiteMap/index.ts:106-:110 — returns false and publishes nothing when the photo feed is null/empty.
- generateSiteMap/index.ts:35 — skips the whole write when no candidates fall inside the window; :43 refuses to advance the watermark when `failed > 0` or `written === 0`.
- utilities/seoSidecar.ts:186-:187 `seoWindowStart` — clamps a future/absurd watermark into `[now − 48h, now]` (`SEO_WATERMARK_FLOOR_HOURS` :162); :175-:179 `readSeoWatermark` swallows read errors (NoSuchKey expected on first run) and returns null; :164 `isoOrNow` substitutes now for an unparseable timestamp.
- Reader-side rejection instead of publish-side: sidecar.js:35 `stripPreciseLocation` deletes any `PRECISE_KEYS` property (:37-:39) and drops `location` when `isPreciseLocation` matches (:40), applied to every parsed object at :70 — because pre-guard objects are still in S3 and in the cache (:20-:22).
- sidecar.js:58-:59 — returns null for an empty id (no request); :76 treats `NoSuchKey`/`NotFound` as normal, logs other errors.

### Two same-purpose patterns (unranked)
1. Scheduled writer: generateSiteMap/index.ts:28 `publishSidecars` → utilities/seoSidecar.ts:133/:119 `putSeoSidecars`/`putSeoSidecar`, body from :99 `buildSeoSidecar`, key from :115 `sidecarKey`.
2. One-off writer: scripts/publish-seo-sidecars.js:198-:214 inline PUT loop, body from :113 `buildSidecar`, key literal at :210. It duplicates the builder rather than importing it (its header says the two shapes must stay identical), and both are pinned against each other by tests/seo-crawler-contract.js:17-:19 and :177-:191.

### Looked for and did not find
- Any reader or validator of the version field: `git grep SEO_SIDECAR_VERSION|\.v` over lambda-fns/lib/scripts at 3813371 — `v` is written (seoSidecar.ts:102, publish-seo-sidecars.js:116) but no code reads or branches on it; only tests assert equality between the two writers.
- A writer on any other path (comment/edit/upload/moderation): `git grep "putSeoSidecar|buildSeoSidecar|seo/"` over lambda-fns, scripts, lib found only generateSiteMap, publish-seo-sidecars.js, processDeletedImage (delete), cleanup-s3.js (prune). The comment-path writer implied by seoSidecar.ts:96-:97 does not exist at this commit.
- Any HTTP read of the public `img.wisaw.com/seo/<id>.json` URL mentioned in seoSidecar.ts:12 and publish-seo-sidecars.js:15 — every reader uses the S3 API (sidecar.js:66-:69); no fetch of the public object.
- A CloudFront behavior or cache policy keyed on `seo/`, and any invalidation call after publishing: none in lib/resources/cloud-front.ts or elsewhere at 3813371; freshness rests on `CacheControl: max-age=60` plus the edge's own 10-minute map.
- A backfill trigger in infrastructure (scheduled input payload, Step Function, or script invoking `backfill: true`) — only the manual-invoke branch at generateSiteMap/index.ts:195.
- Budget note: 14 files read; nothing material left unread for this question beyond fixtures and remaining test bodies.