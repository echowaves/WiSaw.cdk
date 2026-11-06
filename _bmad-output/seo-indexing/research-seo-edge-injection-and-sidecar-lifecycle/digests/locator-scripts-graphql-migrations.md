## Digest — areas `scripts/`, `graphql/`, `migrations/` @ 3813371

**Q1 — SEO injection for `/photos/<uuid>` and `/videos/<uuid>` at the edge (request→response)**
- `scripts/publish-seo-sidecars.js:4` (header comment) @ 3813371 — states the sidecar objects are what `injectMetaTagsLambdaFunction` reads; public URL form `img.wisaw.com/seo/<id>.json` at :15.
- `scripts/publish-seo-sidecars.js:210` (main) @ 3813371 — key written is `seo/<photo uuid>.json`, i.e. the sidecar is looked up by the same UUID that is in the page path; `CacheControl: max-age=60` at :213 bounds edge freshness.
- `migrations/20250719120001-replace-integer-ids-with-uuids.js:60` (up) @ 3813371 — `Photos.photoUuid` renamed to `Photos.id`: the UUID in `/photos/<uuid>` is now the primary key.
- `migrations/20250719120000-rename-s3-objects.js:38`, `:42` (up) @ 3813371 — media objects renamed to `<photoUuid>.webp` / `<photoUuid>.mov`, so the UUID selects both page assets and sidecar.
- `migrations/20210822214009-photo-video.js:5` (up) @ 3813371 — `Photos.video` boolean, the flag that splits `/photos/` vs `/videos/`.
- `graphql/schema.graphql:21`, `:30-32` (Photo) @ 3813371 — `uuid`, `videoUrl`, `video` fields exposed to clients; `graphql/schema.graphql:276` (getPhotoById) @ 3813371 — `photoId`+`uuid` lookup, the shape a page-level fetch would use.

**Q2 — `seo/*.json` sidecars: creation, publication, reads**
- `scripts/publish-seo-sidecars.js:113` (buildSidecar) @ 3813371 — body shape `v/caption/labels/created/location/width/height`; mirrors `buildSeoSidecar` in `lambda-fns/utilities/seoSidecar.ts`, must stay identical (:18-20).
- `scripts/publish-seo-sidecars.js:150` (QUERY) @ 3813371 — source query: active photos, `lastComment`, labels from `Recognitions.metaData->'Labels'`, address columns only; :166 — non-array-`Labels` scalar guard (`22023`) copied from `generateSiteMap`.
- `scripts/publish-seo-sidecars.js:68` (BUCKET_NAME) @ 3813371 — bucket is `wisaw-img-<env>`, not the CDN hostname in `S3_IMAGES`; :205-213 (main) @ 3813371 — batched/concurrent `PutObject`, `application/json`.
- `scripts/publish-seo-sidecars.js:93` (locationText), `:101` (PRECISE_KEYS), `:103` (isPreciseLocation), `:124-129` (buildSidecar guards) @ 3813371 — place-name-only location; throws rather than publish coordinates.
- `scripts/cleanup-s3.js:19` (SIDECAR_KEY_RE) @ 3813371 — the read/delete contract: exactly `seo/<lowercase-uuid>.json`; :15-16 — names `sidecarKey()` in `lambda-fns/utilities/seoSidecar.ts` as the writer-side contract.
- `migrations/20210803200000-photo-last-comment.js:5` (up) @ 3813371 — `lastComment` column → sidecar `caption`; `migrations/20250728194101-add-photo-dimensions.js:6`, `:15` (up) @ 3813371 — `width`/`height` → sidecar dims; `migrations/20260514000000-add-photo-locality.js:13`, `:18` and `migrations/20260519120000-add-photo-district.js:7` (up) @ 3813371 — `locality`/`region`/`district` → sidecar `location`; `migrations/20191121212000-create-recognitions.js:14` (Recognitions.metaData) @ 3813371 — labels source.
- `scripts/populate-photo-dimensions.js:163` (updatePhotoDimensions) @ 3813371 — backfills the dims a sidecar publishes; `scripts/populate-recognitions.js:177` (generateImageRecognitions) @ 3813371 — fills `metaData.Labels` a sidecar reads.

**Q3 — photo deletion lifecycle (user request → DB row → S3)**
- `graphql/schema.graphql:401` (deletePhoto) @ 3813371 — user-facing entry point, `(photoId, uuid) → String!`; `graphql/schema.graphql:472` (removePhotoFromWave) @ 3813371 — wave unlink; `graphql/schema.graphql:27` (Photo.active) @ 3813371 — the row is soft-deleted, not removed.
- `migrations/20181715253221-active-photo.js:5`, `:12` (up) @ 3813371 — adds `Photos.active` + index; that flag is the deletion marker every reader uses.
- `scripts/cleanup-s3.js:80` (getPhotoIds) @ 3813371 — reconciler's notion of "alive" is `SELECT id FROM Photos WHERE active = true`; :153-162 (main) @ 3813371 — keys whose photo id is absent are marked for deletion; :187-194 (main) @ 3813371 — per-key `DeleteObjectCommand` (media and orphan sidecars).
- `migrations/20250719120000-rename-s3-objects.js:98` (renameS3Object) @ 3813371 — copy+delete is the only S3 rename here; shows the three keys per photo (`<id>.webp`, `<id>-thumb.webp`, `<id>.mov`) that deletion must cover.
- `migrations/20171020203423-create-photo.js:3` (up) @ 3813371 — no FK cascade from `Photos`; child rows (`Comments`/`Watchers`/`Recognitions.photoId`, `migrations/20250718120000-add-photo-uuid-columns.js:15-48`) are not DB-cascaded.

**Q4 — how `scripts/cleanup-s3.js` classifies and deletes keys**
- `scripts/cleanup-s3.js:33` (classifyKey) @ 3813371 — pure `(key, activeIds) → keep|delete|report`; sidecar branch first (`activeIds.has(sidecarId)`), else media prefix; :21 (extractPhotoId) @ 3813371 — leading-UUID prefix match for `uuid.*`/`uuid-thumb.webp`/`uuid.mov`; :40-43 — unrecognized key ⇒ `report`, never deleted.
- `scripts/cleanup-s3.js:27-32` (classifyKey comment) @ 3813371 — the rule table and why: old code deleted every non-UUID key, taking out ~22k sidecars and the watermark.
- `scripts/cleanup-s3.js:58` (getPhotoIds), `:94` (getS3Objects) @ 3813371 — active-id set + paginated `ListObjectsV2`; :87-91 — on DB failure it returns an empty set and the run degrades to LIST-ONLY (:133-146), i.e. deletes nothing; :120 (main) `--dry-run`, :150-183 — collect/report/dry-run exits, :187-194 — sequential deletes; :4-6 — module is side-effect-free so tests can import the classifier; :209 (module.exports) @ 3813371 — exports `classifyKey`, `extractPhotoId`.

**Q5 — how tests verify edge SEO behaviors and sidecar lifecycle**
- `scripts/cleanup-s3.js:5` (header comment) @ 3813371 — names `tests/seo-sidecar-lifecycle.js` as importing this classifier; that is why env/S3/DB setup lives inside `main()` (:6).
- `scripts/publish-seo-sidecars.js:20`, `:91` (header/locationText comment), `:231-232` (module.exports) @ 3813371 — names `tests/seo-crawler-contract.js` as pinning the published body shape and that both writers publish the same keys/reject the same values; exports `buildSidecar`, `pickLabels`, `QUERY` for it.
- `scripts/publish-seo-sidecars.js:124-129` (buildSidecar) @ 3813371 — throw-on-coordinate paths are the contract the crawler test pins (added in 3813371 alongside `tests/seo-crawler-contract.js`).
- History within budget: `42a227a fix(seo): retire sidecars when their photo is destroyed` touched `scripts/cleanup-s3.js` (+114/-…) and added `tests/seo-sidecar-lifecycle.js`; `3813371` touched `scripts/publish-seo-sidecars.js` and `tests/seo-crawler-contract.js`.

**Q6 — why string concatenation, byte-exact HTML matching, `DEPLOY_ENV=prod` gate**
- No evidence in my three paths. Closest: `scripts/publish-seo-sidecars.js:4-5` (header) @ 3813371 — the sidecar exists because ~21k URLs are already indexed and crawlers must get titles/descriptions/alt at once (the stakes behind byte-exact matching); `scripts/cleanup-s3.js:32` (classifyKey comment) @ 3813371 — records the mass-deletion incident that motivates conservative, contract-pinned behavior.

**Searched, found nothing (all at 3813371, paths `-- scripts graphql migrations` plus the excluded-path pathspecs)**
- `git grep -n -i -E "edge|DEPLOY_ENV|template literal|concatenat|byte-exact"` → no hits; no env gate or edge-runtime rationale is documented in these areas (Q6 evidence lives in `lambda-fns/`, `lib/`).
- `git grep -n -i "seo" -- migrations` → no hits; sidecars have no table/migration, they are pure S3 objects.
- `git grep -n -E "photos/|videos/|canonical"` → only `scripts/publish-seo-sidecars.js:15` (`img.wisaw.com/seo/<id>.json`); no route or canonical strings here.
- `git grep -n -E "deletedAt|paranoid" -- migrations` → none; deletion is `active=false`, not a timestamp.
- `git grep -n -E "mocha|tests/" -- migrations graphql` → none; the only test hooks in my areas are the two `scripts/` citations above.
- No test files exist under `scripts/`, `graphql/`, or `migrations/` (`git ls-tree -r --name-only 3813371` lists 4 scripts, 1 schema, 57 migrations).