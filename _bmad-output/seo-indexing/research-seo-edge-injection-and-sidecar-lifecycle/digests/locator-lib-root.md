## Digest — areas `lib/`, `bin/`, `config/`, `cdk.json`, top-level files @ 3813371

### 1. SEO injection for `/photos/<uuid>` and `/videos/<uuid>` at the edge (request → response)
- `lib/resources/cloud-front.ts:8` (createCloudFront) — the whole CloudFront layer; `:9` returns early unless `deployEnv() === 'prod'`, so no edge behavior exists in the test stack.
- `lib/resources/cloud-front.ts:128` (`additionalBehaviors['photos/*']`) and `:149` (`['videos/*']`) — S3 origin `webAppBucket`, `htmlCachePolicy`, `ALLOW_ALL`, plus two edge lambdas each: `:137`/`:158` `ORIGIN_REQUEST` → `injectMetaTagsLambdaFunctionPhoto` / `…Video` with `includeBody: true`; `:142`/`:163` `VIEWER_REQUEST` → `redirectLambdaEdgeFunction`.
- `lib/resources/cloud-front.ts:106` (defaultBehavior) — `:114` redirect at VIEWER_REQUEST, `:121` `injectStaticMetaTagsLambdaFunction` at ORIGIN_REQUEST for non-media routes; `:105` `defaultRootObject: '/index.html'`; `:85` `domainNames: www.wisaw.com/wisaw.com/link.wisaw.com`.
- `lib/resources/cloud-front.ts:52` (htmlCachePolicy) — minTtl 0 so the injector's `Cache-Control` wins, no cookies/query in the cache key; comment records `age: 425` on a `max-age=100` body as the reason. `:93` (htmlForwardPolicy) forwards nothing to origin.
- `lib/resources/lambdas.ts:300` (injectMetaTagsLambdaFunctionPhoto) — `cloudfront.experimental.EdgeFunction`, code asset `lambda-fns/lambdas/injectMetaTagsLambdaFunction`, `:314` handler `photo.handler`, 128 MB / 5 s, **no** environment; `:330` video twin (`:344` `video.handler`); `:394` static (`:406` `static.handler`) from the same bundle; `:360` redirect (`index.handler`).
- `lib/resources/buckets.ts:76`–`:84` — injector grantRead on `webAppBucket` (the app shell HTML it rewrites) and grantReadWrite on `imgBucket` (media + sidecars); `:91` static injector is read-only; `:86` redirect read-only.
- `lib/resources/cloud-front.ts:201` (errorResponses) — 403/404 → `/404.html` with status preserved, ttl 5 min; comment at `:196` explains the year of soft-404 index.html rewrites.
- `lib/resources/cloud-front.ts:225` (`wisaw-img-distro`) — `img.wisaw.com`, no edge lambda; `:248` comment on why error rewrites were removed there.
- `lib/wi_saw.cdk-stack.ts:30` (WiSawCdkStack ctor) — `createCloudFront(this, buckets, lambdas)` wiring order.

### 2. `seo/*.json` sidecars: created, published, read
- `lib/resources/lambdas.ts:229` (generateSiteMapLambdaFunction) — entry `lambda-fns/lambdas/generateSiteMap/index.ts`; `:246` "The run also publishes SEO sidecars for recently changed photos on top of building the sitemap"; `:248` timeout raised to 120 s for that work.
- `lib/resources/lambdas.ts:261` (Rule `lambda-polling-rule`) — `Schedule.rate(5 hours)` = publish cadence.
- `lib/resources/buckets.ts:69`–`:73` — grantReadWrite on `webAppBucket` *and* `imgBucket`; `:71` comment names `seo/<id>.json` sidecars and says the edge injector reads them from the media bucket. Read path = `buckets.ts:78`/`:83`.
- `package.json:21` (`scripts.seo-sidecars`) / `:22` (`seo-sidecars:dry-run`) — `node ./scripts/publish-seo-sidecars.js`, i.e. a manual backfill entry point alongside the scheduled publisher.
- `lib/utilities/config.ts:5` (loadConfig) + `lib/resources/lambdas.ts:103` (`...config`) — `.env.<env>` values are spread into every non-edge lambda; `.env.sample:9` `S3_BUCKET: 'wisaw-img-test'`, `:12` `S3_BUCKET_PRIVATE`. Edge functions get no env at all (`lambdas.ts:317-319` commented out), so the injector cannot take bucket names from config.
- Commit `49f8013` *feat(seo): publish and read per-photo SEO sidecars at the edge* — states the reason (Lambda@Edge cannot join a VPC, so it can't reach Postgres; generateSiteMap copies caption/labels/place into `seo/<id>.json`) and names `SIDECAR_LOOKBACK_HOURS`; lib diff = buckets/cloud-front/lambdas/package.json.

### 3. Photo deletion lifecycle (code in these areas that touches it)
- `lib/resources/resolvers.ts:40` (`Mutation.deletePhoto` entry) + `:72` (fields.forEach createResolver) — AppSync maps the user's mutation to the single lambda data source; source defined at `lib/wi_saw.cdk-stack.ts:43`–`:46`.
- `lib/resources/lambdas.ts:24` (wisawFn) — entry `lambda-fns/index.ts`, env `...config`; DB access via `lib/wi_saw.cdk-stack.ts:34` (`database.grantConnect(wisawFn, config.username)`).
- `lib/resources/database.ts:8` (createDatabase) — imported RDS instance `wisaw-<env>`, endpoint hardcoded `:14`; the rows the mutation deletes live here. `config/config.js:33` (buildConfig) / `:51` exports — same DB creds for sequelize-cli (`package.json:13` `migrate`) at schema level.
- `lib/resources/buckets.ts:26`–`:34` — imgBucket grants: wisawFn ReadWrite/Put/PutAcl (`:28`–`:30`), explicit grantDelete only for processUploadedImage (`:32`) and processDeletedImage (`:34`).
- `lib/resources/buckets.ts:51` (addEventNotification OBJECT_REMOVED, suffix `-thumb.webp`) → `processDeletedImageLambdaFunction`; so S3-side fan-out fires only for thumb keys.
- `lib/resources/lambdas.ts:130` (processDeletedImageLambdaFunction) — entry `lambda-fns/lambdas/processDeletedImage/index.ts`, 1 GB/30 s, env `...config` (`:159`) = DB creds available to it.
- `lib/resources/cloud-front.ts:201` + comment `:196` — deleted-photo URLs now answer 404 instead of a live-looking index.html.

### 4. `scripts/cleanup-s3.js` classification/deletion
Only the entry points are in my area: `package.json:19` (`cleanup-s3`) and `package.json:20` (`cleanup-s3:dry-run`, `--dry-run` flag exists). No CDK resource, IAM grant, bucket name, or config key in `lib/`, `bin/`, `config/`, `cdk.json` references that script or its key classes.

### 5. Test coverage of edge SEO behaviors and sidecar lifecycle
- `package.json:8` (`scripts.test`) — `nyc … mocha --exit --require @babel/register ./tests/*.js --timeout 30000`; the only test entry point in these areas (no per-file or CDK-synth script).
- `package.json:36`–`:52` (devDependencies) — `chai`, `chai-http`, `supertest`, `mocha`, `nyc`, `pg`, `sequelize`: HTTP/fixture-level assertions, no `aws-cdk-lib/assertions`.
- `package.json:9`–`:12` (`test:deploy` / `test:destroy` vs `prod:deploy` / `prod:destroy`) — with `DEPLOY_ENV=test` the edge functions and distributions are never created (`lib/resources/lambdas.ts:222`, `lib/resources/cloud-front.ts:9`, `lib/resources/buckets.ts:61`), so tests, not deploys, are the only check on injector/sidecar code.
- Commit `49f8013` message names `tests/seo-crawler-contract` covering the sidecar reader against a served shell fixture (test file itself is outside my area).

### 6. Why string concatenation, byte-exact HTML matching, `DEPLOY_ENV=prod` gate
- String concatenation: no rationale exists in these areas (see negatives). The two reverts cited by project instructions (`625562a`, `f18a623`) touch only `lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js` — outside my area; the in-area constraint that matches it is `lib/resources/lambdas.ts:317` (edge functions carry **no** environment and are shipped as a raw `Code.fromAsset` directory, `lambdas.ts:307`, not esbuild-bundled like every non-edge lambda: contrast `:24-40`/`:136` which use `NodejsFunction` + `bundling`), so the edge bundle is not transpiled down.
- Byte-exact matching: in-area evidence that the injector rewrites a deployed template it does not own — `lib/resources/buckets.ts:77` (injector reads `webAppBucket`, the Vite app shell uploaded by someone else) and the comments written from live incidents at `lib/resources/cloud-front.ts:46` (`age: 425` vs `max-age=100`), `:102` (`x-cache: Error from cloudfront` on `/`), `:86`–`:89` in `lambdas.ts` (four routes looked like copies of wisaw.com/), `lib/resources/cloud-front.ts:196` (a year of soft-404s), `:248` (HTML served for a broken `.webp`).
- `DEPLOY_ENV=prod` gate: `lib/utilities/config.ts:1` (`deployEnv()` defaults to `'test'`) → `lib/resources/lambdas.ts:222` and `lib/resources/cloud-front.ts:9`; `lib/resources/buckets.ts:61` (webAppBucket `wisaw.com` is imported only in prod, so a test stack has nothing to inject into); `bin/wi_saw.cdk.ts:7` (stack id `<env>-WiSawCdkStack`) and `package.json:9`–`:12` (separate deploy/destroy per env). The prod-only resources are global/hardcoded: ACM ARNs `lib/resources/cloud-front.ts:22`/`:29`, `domainNames` `:85`, and Lambda@Edge's us-east-1 log-group naming wrangling at `lib/resources/lambdas.ts:270`–`:296`.

### Searched, found nothing (all at commit 3813371)
- `git grep -n -i "concat|byte-exact|template literal|edge runtime|revert|deindex" -- lib bin config cdk.json package.json README.md` → zero hits (no in-area rationale for the string-concat/byte-exact rules).
- `git grep -n -i "sidecar|seo|bucket|lookback|deploy_env" -- .env.sample .gitignore .babelrc .npmignore skills-lock.json` → only `.env.sample:9`/`:12`; no `SIDECAR_LOOKBACK_HOURS` or SEO key in any top-level config file.
- `git grep -n -i "assertions|synth|StackInspector|tests/" -- lib bin config cdk.json package.json README.md` → only the `package.json:8` test script; no CDK synth/template tests exist.
- `git grep -n -p "cleanup" -- lib bin config cdk.json` → 7 hits, all `lib/resources/lambdas.ts:164`–`:213` (`cleanupAbuseReportsLambdaFunction`, a daily scheduled DB job) — nothing about S3 key cleanup; `scripts/cleanup-s3.js` classification logic is outside my area.
- `git grep -n -p "deletePhoto|Delete" -- lib bin config cdk.json` → no resolver-level or stack-level code that deletes rows or objects itself; the mutation is dispatched into `lambda-fns/` (outside my area).