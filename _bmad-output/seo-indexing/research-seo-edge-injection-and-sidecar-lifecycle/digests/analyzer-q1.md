## Digest — Q1 `how`: SEO injection for `/photos/<uuid>` and `/videos/<uuid>` at the edge @ 3813371

### Claims

**Provisioning (what makes the path exist at all)**
- ★ The whole CloudFront surface is prod-only: `lib/resources/cloud-front.ts:8` createCloudFront, early `return` when `deployEnv() !== 'prod'` @ 3813371; the edge functions themselves are inside `if (deployEnv() === 'prod')` `lib/resources/lambdas.ts:222` @ 3813371.
- ★ `photos/*` and `videos/*` are dedicated cache behaviours on the wisaw.com distribution, origin = `webAppBucket` via Origin Access Control: `lib/resources/cloud-front.ts:128-148` ('photos/*'), `:149-168` ('videos/*') @ 3813371.
- ★ Each media behaviour carries exactly two Lambda@Edge hooks, no viewer-response hook: VIEWER_REQUEST = redirect (`:141-145`, `:162-166`) and ORIGIN_REQUEST = photo/video injector (`:136-140`, `:157-161`) @ 3813371.
- All four are `cloudfront.experimental.EdgeFunction` (Lambda@Edge, not CloudFront Functions), 128 MB / 5 s: photo `lib/resources/lambdas.ts:300-323` handler `'photo.handler'` `:314`; video twin `:330-353` handler `'video.handler'` `:344`; redirect `:360-383` handler `'index.handler'` `:374`; static `:394-411` handler `'static.handler'` `:406` @ 3813371.
- Photo and video are two entry points into one code asset (same directory, different handler string): `lib/resources/lambdas.ts:307-312` + `:337-342` @ 3813371.
- ★ The injector answers the origin request itself — it returns a complete CloudFront response object from an origin-request handler, so S3 never serves the page body: `lambda-fns/lambdas/injectMetaTagsLambdaFunction/photo.js:79` → `htmlResponse` `utils.js:247-265`; video `video.js:85` @ 3813371.
- Cache policy lets the injector's own `Cache-Control` decide TTL (minTtl 0, default 60 s, max 24 h; query strings and cookies excluded from the key): `lib/resources/cloud-front.ts:52-60` htmlCachePolicy, `:93-97` htmlForwardPolicy @ 3813371.
- TTL actually emitted: 200 pages get the default `max-age=100` (`utils.js:248` htmlResponse, used bare at `photo.js:79`, `video.js:85`); the 404 exits override with `max-age=86400` (`photo.js:21`, `:35`; `video.js:18`, `:31`) @ 3813371.
- ★ Crawler payload construction: title/description/OG/twitter/canonical rewrite plus a crawler-visible body swap — `utils.js:160-242` injectMetaTags, `:68-73` renderRootBody (replaces `<div id="root">…</div>`), `:79-158` buildSeoBody (h1, `<img>`/`<video>`, description, tag links, JSON-LD `Photograph`/`VideoObject` at `:124-148`) @ 3813371.
- Crawler directives go out as headers too, not only meta tags: `utils.js:252-254` htmlResponse `x-robots-tag`; 404 documents additionally carry `<meta name="robots" content="noindex, follow">` and a homepage canonical at `utils.js:51-62` renderNotFoundDocument @ 3813371.
- ★ The media/sidecar bucket is a hardcoded fallback, not injected config: `photo.js:10`, `video.js:10`, `sidecar.js:16` `WISAW_IMG_BUCKET || 'wisaw-img-prod'`, while the EdgeFunction `environment` blocks are commented out (`lib/resources/lambdas.ts:319-321`, `:349-351`) @ 3813371; it matches the imported bucket name `wisaw-img-${deployEnv()}` `lib/resources/buckets.ts:21-25` @ 3813371.
- ★ IAM on that path: photo/video injectors get `webAppBucket.grantRead` (the shell) + `imgBucket.grantReadWrite` (sidecar read, media list/head): `lib/resources/buckets.ts:76-84` @ 3813371; redirect gets only `grantRead` `:86-88`; static `:91-93`.
- The SEO text is published offline, not fetched from Postgres (edge functions can't join a VPC): `sidecar.js:4-8` note; writer `lambda-fns/utilities/seoSidecar.ts:115-122` sidecarKey/putSeoSidecar (`seo/<lower-id>.json`) into the img bucket, granted at `lib/resources/buckets.ts:69-74`, refreshed by a 5-hour schedule `lib/resources/lambdas.ts:261-266` @ 3813371.
- The `img.wisaw.com` URLs the injected tags point at are a second distribution with no edge lambdas and no custom error pages: `lib/resources/cloud-front.ts:225-252`; the URLs are built at `utils.js:200`/`:208` (og/twitter image), `video.js:47-48` mediaKey/videoUrl @ 3813371.
- The distribution-level 403/404 → `/404.html` rewrites `lib/resources/cloud-front.ts:201-214` never see a media page, because the injector short-circuits before the origin; media misses are answered by `renderNotFoundDocument`.

### Call stack (photos; video identical except where noted)

- CloudFront VIEWER_REQUEST — `lambda-fns/lambdas/redirectLambdaEdgeFunction/index.js:3` handler @ 3813371
  - `index.js:34` mediaMatch → `:38` canonical check → `:39` buildRedirect (`:15-27`, 301 + querystring) — lowercase-id / trailing-slash consolidation; integer ids `:44-51`; www→apex `:59-62`; otherwise pass request through `:82`
- CloudFront ORIGIN_REQUEST (cache miss only) — `lambda-fns/lambdas/injectMetaTagsLambdaFunction/photo.js:13` handler @ 3813371
  - `photo.js:15` → `mediaUri.js:23` parseMediaUri (`:25` route regex, `:14`/`:30` SUFFIX_RE, `:31` trailing-slash strip, `:32` toLowerCase, `:34` UUID_RE)
  - `photo.js:24` → `utils.js:19` sanitizeImageId (`:11` normalizeImageId, `:3` escapeHtmlAttribute)
  - `photo.js:26-29` Promise.all
    - `sidecar.js:57` fetchSidecar → `:61` key `seo/<id>.json`, `:63` TTL cache (`:11` 10 min, `:12`/`:44-51` FIFO cap 500), `:66-69` S3 GetObject us-east-1, `:70` → `sidecar.js:35` stripPreciseLocation (`:23` PRECISE_KEYS, `:25` isPreciseLocation)
    - `media.js:28` probeMedia → `:30-32` ListObjectsV2 prefix `<id>.` MaxKeys 8, `:36-38` preferred object (`:13` VIDEO_EXT_RE), `:47`/`:17` isDefinitiveMiss
    - (video only) `video.js:34` → `media.js:56` readDuration → HeadObject `Metadata.duration` `:59-60`
  - `photo.js:38` → `seoText.js:59` buildSeoFields (`:20` truncate, `:29` monthYear, `:37` normaliseLabels; title budget `:72-86`, description budget `:91-105`)
  - `photo.js:46` → `template.js:29` fetchShell (`:10-12` bucket `wisaw.com`/`index.html`/60 s cache, `:35-37` GetObject, `:20` fallbackShell)
  - `photo.js:48` → `utils.js:79` buildSeoBody; `photo.js:61` → `utils.js:160` injectMetaTags (`:28` stripExistingMetaTags, `:193` title, `:198-213` meta block + og:video, `:223` canonicalPattern, `:232` `</title>` anchor, `:237` → `utils.js:68` renderRootBody)
  - `photo.js:79` → `utils.js:247` htmlResponse(200) — returned to CloudFront as the cached origin response

### Checks on the path that reject a value or throw

- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/mediaUri.js:26` parseMediaUri — rejects anything not matching `^/(photos|videos)/(.+)$` → `{kind:null, valid:false}` @ 3813371
- `mediaUri.js:34` — rejects (valid:false) any id that is not a lowercase-canonical UUID after `/full`,`/thumb` (`:14`) and trailing-slash (`:31`) stripping and lower-casing (`:32`); i.e. uppercase-only ids survive, non-UUID remnants (`/photos/x`, `/photos/a/b/c`) do not @ 3813371
- `photo.js:20-22`, `video.js:17-19` — invalid parse → HTTP 404 + noindex + `max-age=86400`, no shell read @ 3813371
- `media.js:33` probeMedia — empty prefix listing → `exists:false`; `media.js:47`/`:17-21` — only HTTP 404 / NoSuchKey / NotFound / NoSuchBucket count as gone; `media.js:51` any other S3 error (AccessDenied, throttling) → `exists:true, inconclusive:true`, page still renders @ 3813371
- `photo.js:34-36`, `video.js:30-32` — `!media.exists` → 404 + noindex @ 3813371
- `template.js:39` fetchShell — rejects a fetched `index.html` with no `<title>` (logs `:44`) and falls back to last good shell or `fallbackShell()` `:20-27`/`:49`; S3 failure caught at `:45-47` @ 3813371
- `sidecar.js:73-81` fetchSidecar — any read error is swallowed to `null` (cached as null), only NoSuchKey/NotFound are silent; never throws into the handler @ 3813371
- `sidecar.js:40` stripPreciseLocation — deletes `location` when it looks like a coordinate (`POINT(`, WKB hex `:31`, `lat,lon` pair `:32`) or is an object `:27` @ 3813371
- `seoText.js:33` monthYear — rejects unparseable dates and years before 2015 → `''` (date dropped from title/description) @ 3813371
- `media.js:57` readDuration — rejects keys not matching VIDEO_EXT_RE → `''`; HeadObject failure caught `:61-64` @ 3813371
- `utils.js:71` renderRootBody — if the shell has no `<div id="root">…</div>`, the crawler body is silently not injected (HTML returned unchanged) @ 3813371
- `utils.js:187` injectMetaTags — lower-cases the canonical id only when it matches the UUID regex (defence against uppercase request URLs becoming their own canonical); `:225` if no canonical link exists after rewrite, one is injected after `<title>` @ 3813371
- `redirectLambdaEdgeFunction/index.js:38` — declines the canonical 301 unless the lower-cased id passes UUID_RE, so malformed spellings fall through to the injector's 404 instead of a redirect @ 3813371
- (writer side, off the request path) `lambda-fns/utilities/seoSidecar.ts:91` assertNoPreciseLocation — throws "refusing to publish a sidecar whose location is a coordinate" @ 3813371

### Two same-purpose patterns (unranked)

1. Canonical-spelling detection for media URLs exists twice: `mediaUri.js:42-48` needsCanonicalRedirect (`mediaUri.js:10` UUID_RE) vs the wired viewer-request consolidator `redirectLambdaEdgeFunction/index.js:34-41` with its own copy of the regex at `index.js:1`. Only the second is on the live path; `needsCanonicalRedirect` has no runtime caller — it appears only in `tests/seo-crawler-contract.js:62-64` @ 3813371.
2. "Read a small S3 object through a module-level TTL cache and degrade instead of failing" exists twice: `template.js:29-50` fetchShell (single slot, 60 s TTL, rejects title-less HTML) vs `sidecar.js:57-82` fetchSidecar (Map keyed by object, 10 min TTL `:11`, FIFO eviction at 500 entries `:44-51`, null on error). Both hardcode `region: 'us-east-1'` and their own bucket string (`template.js:10`; `sidecar.js:16`).
   (Also duplicated for the same purpose: the byte-tolerant canonical rewrite in `utils.js:222-230` injectMetaTags and `utils.js:287-294` injectRouteTags; the precise-location guard in `sidecar.js:23-42` and `seoSidecar.ts:66-92`.)

### Looked for and did not find (at 3813371)

- No viewer-response association on `photos/*`/`videos/*` — only VIEWER_REQUEST + ORIGIN_REQUEST (`cloud-front.ts:135-167`); no header post-processing after the injector.
- No code that sets `WISAW_IMG_BUCKET` for these functions (grep over the repo hits only the three fallback reads) — so prod always uses `wisaw-img-prod`.
- No `package.json` or vendored `node_modules` inside the injector asset dir (`git ls-tree` shows nine `.js` files only), and `Code.fromAsset` with no bundling (`lambdas.ts:307-312`) — `@aws-sdk/client-s3` must come from the Node.js 22 runtime; I found no in-repo packaging for it.
- No TTL longer than 100 s anywhere for a successful media page, despite the comment at `photo.js:76-78` claiming a "longer TTL": `htmlResponse` defaults to `max-age=100` (`utils.js:248`).
- No use of `needsCanonicalRedirect` outside tests; no redirect logic inside photo.js/video.js (redirect concerns live only in the viewer-request function, per its comment at `index.js:29-33`).
- Budget: 15 files — 14 read (photo.js, video.js, mediaUri.js, sidecar.js, media.js, seoText.js, template.js, utils.js, static.js, redirect/index.js, cloud-front.ts, lambdas.ts, buckets.ts, seoSidecar.ts); unread and still open: `lambda-fns/lambdas/generateSiteMap/index.ts` (how/when sidecars are refreshed) and `tests/inject-meta-tags.js` / `tests/seo-crawler-contract.js` (assertions pinning this behaviour).