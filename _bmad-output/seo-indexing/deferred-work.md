# Deferred work — seo-indexing

- source_plan: `_bmad-output/seo-indexing/tickets/bug-photo-delete-leaves-objects-live-plan.md`
  summary: RESOLVED (2026-11-06, needs one operator edit): `CLOUD_FRONT_DISTRIBUTION='E275CUZVESLWC7'` in `.env.prod` names a distribution that **does not exist** — CloudFront returns NoSuchDistribution. The real img.wisaw.com distribution is **`E3R5Y1ZTD8Z237`** (confirmed twice: `aws cloudfront list-distributions` alias match, and the `prod-WiSawCdkStack` output `ImgCloudFrontDistributionId`). `.env.prod` must be corrected to that id before shipping cleanup to prod; until then every prod invalidation fails with NoSuchDistribution (logged and swallowed by deletePhoto), so deleted media would keep serving from edge cache for up to 10 days. APPLIED by the agent on 2026-11-06 with explicit user authorization (standing "never edit .env.prod" policy waived for this one line); reload verified (`config().CLOUD_FRONT_DISTRIBUTION === 'E3R5Y1ZTD8Z237'`) and the distribution is Deployed with domain dcr73gd0zw86x.cloudfront.net. Takes effect on the next deploy that ships wisawFn's env.
  evidence: Review pass 1 triage #3 predicted exactly this failure mode; verification commands run live against account 963958500685 on 2026-11-06.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-photo-delete-leaves-objects-live-plan.md`
  summary: RESOLVED, no action needed (2026-11-06): legacy key shapes are a non-issue in prod. `npm run cleanup-s3:dry-run prod` found **0 unreferenced objects** across 66,709 keys (21,956 active photos), and a full-bucket shape census shows **zero extension-less UUID keys** — the bucket holds only `<id>.webp`, `<id>-thumb.webp`, `<id>.mov` (840), `seo/<id>.json` sidecars for every photo, and the single `seo/_last-run.json` watermark. No legacy shapes need joining the delete set; AC1's "bucket listing shows none" holds for the modern key contract.
  evidence: Review pass 1 triage #10 — settled by the dry-run + census run against wisaw-img-prod on 2026-11-06.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-photo-delete-leaves-objects-live-plan.md`
  summary: OPEN — dry-run the unconditional cleanup on the TEST stack first (deploy, delete a photo there, verify objects gone + CDN refetch fresh within an hour) before promoting to prod — with the PHOTO_DELETE_CLEANUP flag removed there is no kill switch short of a rollback deploy.
  evidence: User decision 2026-11-06 ("no flag, unconditional cleanup"); replaces the per-environment flag verification entry from review pass 1 triage #1 / pass 2 row 12, which became moot.

- source_plan: `_bmad-output/seo-indexing/plan-render-root-body-anchor-safety.md`
  summary: OPEN (highest priority of the secondary findings) — head injection anchors on the **first literal `</title>` in the whole document** (`injectMetaTagsLambdaFunction/utils.js:406`, and the same string anchor at `:480` in `injectRouteTags`). A comment or inline script placed before `<title>` that contains the token `</title>` swallows the entire meta block into itself; tag counts still read correct while the head serves no og:/twitter:/description tags at all — silent SEO loss, the same failure class as the 22k-page deindexing. Fix by locating the real `</title>` with the comment/raw-text masking helpers already added to utils.js (`maskNonStructural`, `endOfTag`), then anchor after it, and pin with a byte-exact crawler-contract case.
  evidence: Secondary assessment probes (task 4) against tests/fixtures/served-index.html with a `<!-- legacy </title> marker -->` decoy: output contained `<!-- legacy </title>\n      <meta name="description" …` and all og: tags before the real `<title>`. Not reachable with bytes currently deployed (served shell has one `<title>`, no decoy token).

- source_plan: `_bmad-output/seo-indexing/plan-render-root-body-anchor-safety.md`
  summary: OPEN — `canonicalPattern` (`utils.js:397` media path, `:462` route path) requires **no whitespace around `=`** and its replace is **non-global**. `rel = "canonical"` is missed entirely, so the rewrite does nothing and the no-canonical fallback injects a second canonical while the stale one survives (1 in → 2 out). Two static canonical links likewise leave the second in place pointing elsewhere. Both produce duplicate/conflicting canonical signals on one URL. Fix: `\brel\s*=\s*(?:"canonical"|'canonical')`, then strip every canonical link and insert exactly one, with byte-exact pins for both shapes.
  evidence: Secondary assessment probes (task 4): `rel = "canonical"` input produced two canonical links in the response; a fixture carrying `/first` + `/second` static canonicals returned `https://wisaw.com/photos/abc` plus the surviving `https://wisaw.com/second`. Served template currently ships no static canonical, so not live.

- source_plan: `_bmad-output/seo-indexing/plan-render-root-body-anchor-safety.md`
  summary: OPEN — the media-path title rewrite `/<title>.*?<\/title>/i` (`utils.js:367`) has no `/s` flag while `injectRouteTags:453` uses `/is`. A `<title>` that wraps onto a second line is left untouched on photo/video pages: the per-page title is never written and the page keeps the generic homepage title (duplicate-title class). One-flag fix, but it rewrites head bytes so it needs its own regression fixture case.
  evidence: Secondary assessment probe (task 4): multi-line served title input → output still contained `Free\n    Stock Photos` and did not contain the requested `<title>My Photo | WiSaw>`. Served title is single-line today, so not live.

- source_plan: `_bmad-output/seo-indexing/plan-render-root-body-anchor-safety.md`
  summary: OPEN — `stripExistingMetaTags` (`utils.js:29-40`) applies global `/gi` meta strips to the **whole document**, not just `<head>`. Meta-looking text inside inline JavaScript, comments, or a `<textarea>` is deleted from it, corrupting those bytes at the edge. Fix by scoping the strip to the head region (or running it against the masked copy). Deferred explicitly because this plan's brief named `stripExistingMetaTags` as out of scope.
  evidence: Secondary assessment probe (task 4): an inline-script statement `var m = "<meta property=\"og:image\" content=\"x\">";` was gone from the injector output. Crawler body markup is unaffected (it emits only h1/p/a/script/ld+json).

- source_plan: `_bmad-output/seo-indexing/tickets/bug-edge-head-tags-rewritten-by-spa-plan.md`
  summary: OPEN — media title and description text are still built twice. The client composes `(photo) Dog, Pet` / `Dog, Pet` from recognition labels (`PhotosComponent.js` `safeTitle`, `videoTitle`), while the edge publishes `buildSeoFields().pageTitle` (`seoText.js:104`, e.g. `Golden retriever on the beach — photo, Brooklyn, Sep 2025 · WiSaw`). Ticket 6 (`tickets/story-seo-text-single-source.md`) owns one text source; until it lands, `<title>`, `og:title`, `twitter:title` and the JSON-LD `name` differ pre- and post-JavaScript for the same URL.
  evidence: Quick review finding 1 on the ticket 4 diff; reproduced in `src/headHydration.contract.test.js` output where the hydrated title is `(photo) Dog, Pet, Beach` against an edge fixture title of `Dog at the beach | WiSaw`.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-edge-head-tags-rewritten-by-spa-plan.md`
  summary: OPEN — static-route copy (`static.js` ROUTES vs `Home.js` / `About.js` / `Contact.js` / `Terms.js`) and the absence of `og:image` + twitter tags on those routes before JavaScript runs. Ticket 7 (`tickets/story-static-route-copy-once.md`) owns both; ticket 4 aligned only the values it could own there (`og:site_name`, `robots`, `og:type`).
  evidence: Quick review findings 3 and 4 on the ticket 4 diff: `stripExistingMetaTags` removes `twitter:(card|title|image|description)` and `og:image` from static routes, `injectRouteTags` re-adds none, and the client's Helmet block adds them after mount.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-edge-head-tags-rewritten-by-spa-plan.md`
  summary: OPEN — `/search/<term>` publishes two canonicals. `static.js routeFor` collapses every `/search/*` request onto the `/search` route, so the edge injects `canonical` / `og:url` = `https://wisaw.com/search`, while `SearchComponent` sets both to `https://wisaw.com/search/<term>`. Fixing it means deciding whether the edge keeps that collapse (a routing change beyond ticket 4's Boundaries), so it belongs with ticket 7.
  evidence: Quick review finding 5 on the ticket 4 diff; the `noindex` value itself agrees (`seoDefaults.ROBOTS_NOINDEX` == `htmlResponse` header in `utils.js`).

- source_plan: `_bmad-output/seo-indexing/tickets/bug-edge-head-tags-rewritten-by-spa-plan.md`
  summary: OPEN — `lambda-fns/models/photo.ts:27` builds `videoUrl` as `<id>.mov`, while `injectMetaTagsLambdaFunction/video.js:57-59` resolves the real S3 key precisely because `<id>.mov` 403s for `.mp4` objects. So `og:video`, `og:video:url`, `og:video:secure_url` and `VideoObject.contentUrl` can point at a nonexistent object, and the client's `og:video:type` guesses `video/quicktime` from that extension with no edge counterpart. Fix in the model resolver so both surfaces read the same key.
  evidence: Quick review finding 8 on the ticket 4 diff; unrelated to head-tag ownership, which is why ticket 4 left it alone.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-edge-head-tags-rewritten-by-spa-plan.md`
  summary: OPEN — video `uploadDate` still has two sources: the edge falls back to S3 `LastModified` (`video.js:56`) while the client uses `photo.createdAt`. Ticket 8 (`tickets/story-real-video-duration.md`) owns getting real media metadata (duration, capture/upload date) to both surfaces; the invented `copyrightYear` in `buildSeoBody` was removed by ticket 4.
  evidence: Quick review finding 9 on the ticket 4 diff, partially patched there.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-edge-head-tags-rewritten-by-spa-plan.md`
  summary: OPEN — a media page can publish itself as `noindex`. When `requestComplete` arrives with no photo - including an AppSync hiccup for an id the edge just served as indexable - `PhotosComponent` renders `NoMatch`, whose Helmet declares `noindex, follow`. Decide what a failed fetch should publish (keep the served directives, or render a retry state that declares nothing) and pin it.
  evidence: Quick review finding 16 on the ticket 4 diff; `NoMatch.js` predates this change, so ticket 4 did not alter its behavior beyond sourcing its constants from `seoDefaults`.

- source_plan: `_bmad-output/seo-indexing/tickets/bug-edge-head-tags-rewritten-by-spa-plan.md`
  summary: OPERATIONAL — deploy the client before the edge. Ticket 4 marks the template's `robots` / `og:site_name` with `data-rh` and strips + re-injects them at the edge; a bundle deployed *before* that change declares no `robots`, so it removes the newly marked tag on hydration and the page keeps only the `X-Robots-Tag` header. Upload `build/` first, then publish the Lambda@Edge version.
  evidence: Quick review finding 15 on the ticket 4 diff; window exists only because deploys are manual and independent in the two repos.
