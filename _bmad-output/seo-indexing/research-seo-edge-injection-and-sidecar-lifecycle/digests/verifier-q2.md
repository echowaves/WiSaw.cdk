# Verifier digest — batch q2 (refs 89–133)

Pinned commit 38133710df3e915f2c4286f9643b77a22cdbfccc (short 3813371); validation level high; opened only via git show/grep at the commit.

ref=[89] | lambda-fns/utilities/seoSidecar.ts:21 (SeoSidecar) @ 3813371 | verified
ref=[90] | lambda-fns/utilities/seoSidecar.ts:99 (buildSeoSidecar) @ 3813371 | verified
ref=[91] | lambda-fns/utilities/seoSidecar.ts:36 (pickLabels) @ 3813371 | verified
ref=[92] | lambda-fns/utilities/seoSidecar.ts:55 (locationText) @ 3813371 | verified
ref=[93] | lambda-fns/utilities/seoSidecar.ts:19 (SEO_SIDECAR_VERSION) @ 3813371 | verified
ref=[94] | lambda-fns/utilities/seoSidecar.ts:4-6 (header comment) @ 3813371 | verified
ref=[95] | lambda-fns/utilities/seoSidecar.ts:115 (sidecarKey) @ 3813371 | verified
ref=[96] | lambda-fns/utilities/seoSidecar.ts:161 (SEO_WATERMARK_KEY) @ 3813371 | verified
ref=[97] | lambda-fns/lambdas/generateSiteMap/index.ts:189 (main) @ 3813371 | verified
ref=[98] | lambda-fns/lambdas/generateSiteMap/index.ts:195 (main) @ 3813371 | verified
ref=[99] | lambda-fns/lambdas/generateSiteMap/index.ts:28 (publishSidecars) @ 3813371 | verified
ref=[100] | lambda-fns/lambdas/generateSiteMap/index.ts:17 (recentlyTouched) @ 3813371 | verified
ref=[101] | lambda-fns/utilities/seoSidecar.ts:133 (putSeoSidecars) @ 3813371 | verified
ref=[102] | lambda-fns/utilities/seoSidecar.ts:119 (putSeoSidecar) @ 3813371 | verified
ref=[103] | lambda-fns/lambdas/generateSiteMap/index.ts:43 (publishSidecars) @ 3813371 | verified
ref=[104] | lambda-fns/lambdas/generateSiteMap/index.ts:37 (publishSidecars) @ 3813371 | verified
ref=[105] | lambda-fns/lambdas/generateSiteMap/index.ts:89 (generateSiteMapQuery) @ 3813371 | verified
ref=[106] | lib/resources/lambdas.ts:246-248 (generateSiteMapLambdaFunction) @ 3813371 | verified
ref=[107] | lambda-fns/lambdas/generateSiteMap/index.ts:106 (main) @ 3813371 | verified
ref=[108] | scripts/publish-seo-sidecars.js:4-20 (header comment) @ 3813371 | verified
ref=[109] | scripts/publish-seo-sidecars.js:113 (buildSidecar) @ 3813371 | verified
ref=[110] | scripts/publish-seo-sidecars.js:68 (BUCKET_NAME) @ 3813371 | verified
ref=[111] | scripts/publish-seo-sidecars.js:150 (QUERY) @ 3813371 | verified
ref=[112] | scripts/publish-seo-sidecars.js:210 (main) @ 3813371 | verified
ref=[113] | scripts/publish-seo-sidecars.js:204-207 (main) @ 3813371 | verified
ref=[114] | package.json:21 (scripts) @ 3813371 | verified
ref=[115] | package.json:22 (scripts) @ 3813371 | verified
ref=[116] | lib/resources/buckets.ts:51-57 (addEventNotification) @ 3813371 | verified
ref=[117] | lambda-fns/lambdas/processDeletedImage/index.ts:68 (_deleteSidecar) @ 3813371 | verified
ref=[118] | lambda-fns/utilities/seoSidecar.ts:152 (deleteSeoSidecar) @ 3813371 | verified
ref=[119] | scripts/cleanup-s3.js:33 (classifyKey) @ 3813371 | verified
ref=[120] | lambda-fns/lambdas/injectMetaTagsLambdaFunction/mediaUri.js:32 (parseMediaUri) @ 3813371 | disputed | parseMediaUri lowercases the id itself (`.toLowerCase()` at :32); it does not do so "via sanitizeImageId" — utils.js:19-26 (sanitizeImageId) only strips /photos, /videos, /full, /thumb and slashes, no lowercasing. The casing-alignment conclusion still holds (sidecarKey lowercases too).
ref=[121] | lambda-fns/lambdas/injectMetaTagsLambdaFunction/photo.js:38-43 (exports.handler) @ 3813371 | verified
ref=[122] | lib/resources/buckets.ts:69-73 (createBuckets) @ 3813371 | verified
ref=[123] | lib/resources/buckets.ts:78 (createBuckets) @ 3813371 | verified
ref=[124] | lambda-fns/utilities/seoSidecar.ts:85 (assertNoPreciseLocation) @ 3813371 | verified
ref=[125] | lambda-fns/utilities/seoSidecar.ts:69 (isPreciseLocation) @ 3813371 | verified
ref=[126] | scripts/publish-seo-sidecars.js:124 (buildSidecar) @ 3813371 | verified
ref=[127] | scripts/publish-seo-sidecars.js:40 (loadEnvConfig) @ 3813371 | verified
ref=[128] | lambda-fns/utilities/seoSidecar.ts:186 (seoWindowStart) @ 3813371 | verified
ref=[129] | lambda-fns/utilities/seoSidecar.ts:175 (readSeoWatermark) @ 3813371 | verified
ref=[130] | lambda-fns/lambdas/injectMetaTagsLambdaFunction/sidecar.js:35 (stripPreciseLocation) @ 3813371 | verified
ref=[131] | lambda-fns/lambdas/injectMetaTagsLambdaFunction/sidecar.js:58 (fetchSidecar) @ 3813371 | verified
ref=[132] | scripts/publish-seo-sidecars.js:198-214 (main) @ 3813371 | verified
ref=[133] | lambda-fns/utilities/seoSidecar.ts:12 (header comment) @ 3813371 | verified

## Notes on re-anchoring and follow-the-edge checks (high level)

- ref=[90]-[92]: `v: SEO_SIDECAR_VERSION` is written at seoSidecar.ts:102 inside buildSeoSidecar (symbol anchored at :99); pickLabels (:36) and locationText (:55) are the same function's labels/location helpers cited as supporting anchors for the shape — they neither contradict nor restate the version line.
- ref=[94]: sidecar.js:4-8 header states "Lambda@Edge cannot reach Postgres (edge functions cannot join a VPC)" — repeated rationale confirmed at both cited sites.
- ref=[106]: rule at lambdas.ts:261-266 is named 'lambda-polling-rule', Schedule.rate 5 hours, LambdaFunction target with no event payload override → scheduled events carry `{}`, so `event?.backfill === true` (index.ts:195) only occurs via manual invoke. A second rule at :209 (`${deployEnv()}_lambda-polling-rule`, 24h) targets cleanupAbuseReports, not generateSiteMap — does not affect the claim.
- ref=[112]: batch-size default 200 and concurrency default 16 are parsed at publish-seo-sidecars.js:70-72; key literal at :210, CacheControl max-age=60 at :213, dry-run print-and-return at :204-206. All facts true in the same function.
- ref=[116]: buckets.ts:51-57 wires OBJECT_REMOVED with suffix filter `-thumb.webp` to processDeletedImageLambdaFunction — supports the delete-path trigger part of the claim; parallel fan-out confirmed at processDeletedImage/index.ts:22-26 (Promise.all of _deleteUpload, _deleteSidecar, _cleanupTables).
- ref=[121]: buildSeoFields is invoked at photo.js:38-43 (sidecar + lastModified from probeMedia); cited :26-29 (fetchSidecar/probeMedia in parallel) supplies the inputs. seoText.js:59 (buildSeoFields): caption/labels/location read at :62-65, `created || lastModified` fallback at :66, width/height returned at :110+; probeMedia returns S3 LastModified (media.js:40-45).
- ref=[126]: the two throws sit at publish-seo-sidecars.js:126 and :129 inside buildSidecar (:113-132); cited :124 is the guard's key-scan line in the same function. loadEnvConfig (:39-55) fails via fail() → process.exit(1) on missing/unknown env and on MODULE_NOT_FOUND of `.env.<env>`.
- ref=[132]: tests/seo-crawler-contract.js requires both `buildSeoSidecar` (lambda-fns/utilities/seoSidecar.ts) and `buildSidecar`/`QUERY` (scripts/publish-seo-sidecars.js) — "both pinned against each other by tests" confirmed.
- ref=[133]: cited :96-97 is the partial-row tolerance comment, not the claim; re-anchored to header :12 ("public: seo/<id>.json sits in the media bucket behind img.wisaw.com"). Followed edges: repo-wide `git grep -i invalidation` at 3813371 → no matches (excluded paths aside); `git grep "seo/" lib/` → only buckets.ts:71 comment, no CloudFront behaviour/cache policy keyed on seo/ in cloud-front.ts; sidecar.js:67-69 and template.js:35-36 read via S3 GetObjectCommand (no public-URL reads); edge map TTL SIDECAR_TTL_MS = 10 min at sidecar.js:11; object CacheControl max-age=60 at seoSidecar.ts:127.
