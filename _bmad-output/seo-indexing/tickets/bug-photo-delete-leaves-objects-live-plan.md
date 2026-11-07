---
title: 'Photo delete removes all S3 objects and invalidates the CDN'
type: 'bugfix'
ticket: '1'
created: '2026-11-06'
status: built
baseline_revision: 'bd36104d23d998a4a4f4be417ceb5d196bd710f9'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `deletePhoto` only sets `Photos.active=false`; the original `${id}.webp`, `-thumb.webp`, `.mov`, and sidecar `seo/<lower-id>.json` stay in `wisaw-img-<env>` and keep serving by direct URL. Cleanup fires only on a thumb OBJECT_REMOVED event nothing in the app produces.

**Approach:** After the soft delete succeeds, when a feature flag is on, the mutation itself deletes all four key shapes for the photo id (original photo/video, thumb, sidecar JSON) and issues one CloudFront invalidation with wildcarded public paths (`/<key>*`), so every object — including query-string cache variants — stops serving within an hour. Thumb removal also fires the existing `processDeletedImage` machinery; DB cascade accepted.

## Boundaries & Constraints

**Always:** Sidecar keys via `sidecarKey()` (lowercase id) unchanged; invalidation paths wildcarded (`/<key>*`) to cover query-string/cookie cache variants under the img distribution's all-QS 10-day cache policy; total cleanup time bounded (~15 s hard deadline) well inside the 30 s Lambda budget so `"OK"` holds even under throttling; invalidation skipped (logged) when no distribution id is configured; absent keys are success; delete failure never fails the mutation response (`"OK"` stays); feature flag gates prod enablement until the operator dry-run passes.
**Never:** No change to `classifyKey`/`extractPhotoId` verdicts, `_deleteUpload`, sidecar body/key contract, byte-exact edge injector, GraphQL schema or delete response; no broad prefix sweeps — only exact keys derived from the photo id; no new DB migrations.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Full cleanup | Flag on, all 4 objects exist | All deleted; one invalidation with wildcard paths `/<key>*` for image/thumb/media/sidecar | — |
| Throttled storage calls | S3/CF slow or retrying | Cleanup stops at its ~15 s deadline; mutation still returns `"OK"` | Bounded, logged |
| Partial objects | Only original exists | Delete absent keys as success; invalidation still issued | NoSuchKey ignored |
| No CDN configured (test) | `CLOUD_FRONT_DISTRIBUTION` empty | Objects deleted; invalidation skipped | Logged, no throw |
| S3 delete fails / flag off | Error or flag disabled | Mutation still returns `"OK"`; failure logged for reconciliation | Logged, no throw |

## Decisions

- DB cascade accepted (user, 2026-11-06): user deletes purge the photo's DB rows via the existing thumb-delete contract, matching operator-cleanup semantics.
- Distribution id `E275CUZVESLWC7` is unverified as the img.wisaw.com CDN; code reads it from config unchanged, and confirming (or replacing with the `ImgCloudFrontDistributionId` output) is part of the pre-enablement human check before prod enablement.
- Authorization stays in the existing framework (user, 2026-11-06): no owner gate and no identity verification added here — cleanup rides deletePhoto's existing trigger exactly as the mutation trusts its caller today. Residual risk (any caller of deletePhoto can destroy media) is accepted and mitigated only by the prod flag gate + pre-enablement human check.

</frozen-after-approval>

## Code Map

- `lambda-fns/controllers/photos/delete.ts` -- mutation handler (`active=false` at :36-41); cleanup call added after soft delete
- `lambda-fns/utilities/seoSidecar.ts:112` -- `sidecarKey()` reuse (lowercase id)
- `lambda-fns/models/photo.ts:25-27` -- media key convention `${S3_IMAGES}/${id}.webp`, `${id}-thumb.webp`, `${id}.mov` (no DB column)
- `lib/resources/buckets.ts:20-56` -- imported bucket, thumb-suffix notification; grants live here (wisawFn already has s3:DeleteObject)
- `lib/resources/lambdas.ts:52` -- wisawFn env = `{...config}` from `.env.<env>` (`lib/utilities/config.ts`)
- `lib/resources/cloud-front.ts:225-256` -- img.wisaw.com distro (prod only), id only as CfnOutput; `.env.prod:8 CLOUD_FRONT_DISTRIBUTION='E275CUZVESLWC7'` is spread into Lambda env — unverified which distro (OQ1)
- `lambda-fns/lambdas/processDeletedImage/index.ts` -- thumb-triggered purge incl. `_cleanupTables`; DO NOT modify
- `scripts/cleanup-s3.js:18-35,206` -- exported classifier + dry-run; patterns only
- `tests/seo-sidecar-lifecycle.js` -- harness to copy (ts-node hook, pem stub, S3 send patching)

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `@aws-sdk/client-cloudfront` pinned `3.1018.0`; `npm install`
- [x] `lambda-fns/utilities/photoCleanup.ts` (new) -- `removePhotoObjects(photoId, opts)`: derive exact keys, DeleteObject each (NoSuchKey ok), single CreateInvalidation with wildcarded paths (`/<key>*`) when distribution id set; whole operation bounded by a ~15 s deadline so it cannot overrun the 30 s Lambda budget; never throws
- [x] `lambda-fns/controllers/photos/delete.ts` -- call cleanup after soft delete when `process.env.PHOTO_DELETE_CLEANUP` truthy (string-safe); wrap so mutation response unchanged on any failure
- [x] `.env.test`, `.env.sample` -- add `PHOTO_DELETE_CLEANUP` (test: 'true'; sample: 'false'). Do NOT touch `.env.prod` — operator-owned; unset means OFF. The `.env.sample` comment must state these env files are gitignored, so enablement is a deploy-time step per environment
- [x] `lib/resources/buckets.ts` -- grant wisawFn `cloudfront:CreateInvalidation` on `arn:aws:cloudfront::<acct>:distribution/<CLOUD_FRONT_DISTRIBUTION>` only when config id non-empty
- [x] `tests/photo-delete-cleanup.js` (new) -- copy lifecycle harness header; cover all five I/O matrix rows (incl. deadline row via a slow fake client); wildcard path assertion; sibling-safety test must use a REAL prefix-collision check (no dead branches); lowercase sidecar key shape

**Acceptance Criteria:** ticket 1's four criteria: all four key shapes gone and public URLs 403/404 ≤1h of delete; same-prefix sibling untouched; tests fail on defect / pass on fix incl. no cross-photo matching; or proof no change needed.

## Design Notes

Cascade (accepted decision): deleting `${id}-thumb.webp` fires the existing thumb-suffix notification → `processDeletedImage` deletes the sidecar again (idempotent) and hard-purges DB rows — same outcome operator cleanup produces today.
Invalidation paths = wildcarded public CDN paths (`/images/<id>*` style — one wildcard per deleted key covers its query-string and cookie cache variants under `basicCachePolicy`, which forwards and caches all QS + cookies with a fixed 10-day TTL; verified at `lib/resources/cloud-front.ts:36-43`).

## Verification

**Commands:**
- `npx mocha --exit --require @babel/register tests/photo-delete-cleanup.js` -- expected: all pass
- `npx mocha --exit --require @babel/register tests/seo-sidecar-lifecycle.js` -- expected: 17 pass unchanged
- `npx mocha --exit --require @babel/register tests/seo-crawler-contract.js && npx mocha --exit --require @babel/register tests/inject-meta-tags.js` -- expected: pass (contract + byte-exact)
- `npm run lint` -- expected: clean
- `DEPLOY_ENV=test npx cdk synth test-WiSawCdkStack` -- expected: synthesizes with new grant only when id configured

## Plan Change Log

Iteration 1 (intent_gap loopback from triage #4): the mutation has no server-side owner check, and enabling cleanup turns that pre-existing gap into irreversible loss of any user's media+rows. Root cause sits in the frozen Intent (it never said WHO may trigger destruction) — human must settle authorization; code reverted to `bd36104d23d998a4a4f4be417ceb5d196bd710f9` pending that answer.
Amendments required in the re-derived plan (from verified triage rows): invalidation paths must wildcard (`/<key>*`) to cover query-string/cookie cache variants under `basicCachePolicy`; total cleanup duration bounded well inside the 30 s Lambda budget so `"OK"` holds under throttling; sibling-safety test gets a real prefix-collision assertion; env enablement recorded as an explicit tracked step (`.env.sample` comment + manual check).
KEEP instructions: photoCleanup module shape (injected clients, never-throws contract, exact-key derivation via `sidecarKey()`, lowercase-once); delete.ts flag parsing (`true/1/yes/on`, string-safe) with swallow-and-log wrapper after `psql.clean()`; buckets.ts conditional `CreateInvalidation` grant only when a distribution id is configured; the 17-test suite structure and its harness header (ts-node hook, pem stub, prototype patching) — extend, don't rewrite.

Iteration 2 (intent resolved): user directed "stay within existing framework" — no authorization change; cleanup rides deletePhoto's trigger as-is (frozen Decisions updated). Amendment per human action: `.env.prod` is operator-owned and must NOT be edited by this work (user reverted an earlier edit); unset flag = OFF.

- 2026-11-06 (implementation): Flag check treats the env string `'false'`/empty as OFF (`true|1|yes|on` enable) — a literal JS truthy test on a string would make `PHOTO_DELETE_CLEANUP='false'` in prod turn cleanup ON, defeating the kill-switch intent.
- 2026-11-06 (implementation): Invalidation paths derive from the real deployed key layout (`/images/*` in the Design Notes example does not exist on img.wisaw.com — media keys sit at the bucket root, sidecars under `seo/`, and `imgUrl` is `https://${S3_IMAGES}/<key>`). Paths are `/` + key: `/<id>.webp`, `/<id>-thumb.webp`, `/<id>.mov`, `/seo/<lower-id>.json`.
- 2026-11-06 (implementation): Media keys are lowercased from the id before use, matching the lowercase-UUID bucket convention in `scripts/cleanup-s3.js` and the sidecar contract; uppercase input is normalized once.

- 2026-11-06 (implementation complete): all six execution tasks landed on top of `bd36104`. Verification: `tests/photo-delete-cleanup.js` 23 passing; `tests/seo-sidecar-lifecycle.js` 17, `tests/seo-crawler-contract.js` 29, `tests/inject-meta-tags.js` 32 unchanged; full suite 192 passing with only the 5 known `getSeasonBoundaries` timezone failures; `ts-standard` clean on every changed file; `tsc --noEmit` clean; `DEPLOY_ENV=test npx cdk synth test-WiSawCdkStack` synthesizes with **no** CreateInvalidation statement (empty `CLOUD_FRONT_DISTRIBUTION`), and a throwaway env with the id set synthesizes exactly one grant on wisawFn for `arn:aws:cloudfront::<AccountId>:distribution/E275CUZVESLWC7`. Defect checks against the new suite: un-wildcarded paths → 3 failures, prefix-sweep key derivation → 16 failures (sibling tests included), naive truthy flag test → 1 failure. Not done here (human/deploy): AC1's live test-environment delete-and-refetch run, the `E275CUZVESLWC7` vs `ImgCloudFrontDistributionId` confirmation, and the operator `cleanup-s3:dry-run` inventory for legacy key shapes (triage #10). `.env.prod` untouched.

## Review Triage Log

Pass 1 (quick lens, iteration 0): high 2 / medium 2 / low 3 (2 rejected) / false 1 / maybe-false 2.

| # | Location | Claim | Verdict | Route | Evidence |
|---|----------|-------|---------|-------|----------|
| 1 | `.env.test`/`.env.prod` | New flag lives only in gitignored env files; enablement is an untracked operator step, so a clean-checkout deploy runs cleanup OFF silently | medium | patch (moot under loopback) | `.gitignore` ignores both files; every stack setting shares this convention, but the new gate needs an explicit enablement note |
| 2 | `photoCleanup.publicPath` | Invalidation emits exact paths only; img distro caches with `queryStringBehavior.all()` + `cookieBehavior.all()` and fixed 10-day TTL, so any `/<key>?x=1` variant survives the purge up to 10 days | high | patch (moot under loopback) | verified `lib/resources/cloud-front.ts:36-43` cache policy on imgDistribution; wildcard `/key*` invalidation required |
| 3 | `photoCleanup` env read | Invalidation against a wrong distribution id reports success while media keeps serving | maybe-false | defer | frozen Decision already routes id verification to the pre-enablement human check; settles by comparing `E275CUZVESLWC7` with the `ImgCloudFrontDistributionId` CfnOutput value |
| 4 | `delete.ts` + cascade | Mutation authorizes by client-supplied args only (no identity check anywhere in dispatcher); flag-on turns a reversible soft-delete of ANY photo id into irreversible media+row destruction; ids are public via sitemaps | high | intent_gap | verified: `Photo.uuid` owner column exists (`lambda-fns/models/photo.ts:3`, indexed since 2017 migration), zero `identity` references in `lambda-fns/index.ts`; pre-existing authz gap, catastrophic amplification caused by this change |
| 5 | `tests/photo-delete-cleanup.js` sibling test | Inner prefix assertion is dead code (`derived.endsWith('/')` never true); equality branch duplicates the set check above — case adds no coverage | low | patch (moot under loopback) | verified in diff lines ~549-560 |
| 6 | `isNoSuchKey` fallback | 404-without-name would be recorded as failure | low | rejected | S3 DeleteObject returns success for absent keys, so the branch is unreachable in practice; fix would add a guard for an undemonstrable state |
| 7 | `photoObjectKeys(photoId: any)` | Exported util accepts non-UUID values and builds junk keys | false | — | only caller (`delete.ts`) runs `assertValidUuid` before cleanup and no other caller exists in the change; speculative future misuse |
| 8 | `removePhotoObjects` sequential calls | SDK retries under throttling can push total past the 30 s Lambda budget, surfacing an AppSync error instead of the promised `"OK"` | medium | patch (moot under loopback) | verified `timeout: cdk.Duration.seconds(30)` at `lib/resources/lambdas.ts:51`; cleanup runs after DB work with unbounded total duration |
| 9 | `package-lock.json` hunk | dayjs/version lock churn bundled into the fix | low | rejected | churn is npm install reconciling the stale lock to already-committed pinned manifests (exact-pin convention); unavoidable when adding a dep, no runtime change beyond manifest intent |
| 10 | Key set vs legacy shapes | Extension-less and pre-rename key shapes are not in the delete set; AC1's "bucket listing shows none" may fail for old photos | maybe-false | defer | settles via `npm run cleanup-s3:dry-run` inventory report: whether non-extension/legacy keys for deleted photos still exist in wisaw-img-prod |

Pass 2 (quick lens, iteration 1): medium 1 (grouped from findings 1+2) / carried-defer 1. Verified clean by the lens this pass: key/path contracts, flag parsing, conditional grant, sibling tests with live control, lockfile reconciliation, GraphQL four-file checklist N/A.

| # | Location | Claim | Verdict | Route | Evidence |
|---|----------|-------|---------|-------|----------|
| 11 | `photoCleanup` deadline paths | (a) Deadline hit mid-delete → already-deleted keys get NO invalidation, stay cached up to 10 days with no reconciliation signal; test locks this in. (b) Deadline during the invalidation call is reported `'failed'`, not deadline semantics; 0-ms remaining budget records a failure without an attempt | medium | patch | verified at `photoCleanup.ts` stoppedAtDeadline branch + `_invalidate` race: both leave S3-deleted objects serving from edge cache, contradicting AC1's ≤1 h window in the throttled scenario |
| 12 | `.env.test` enablement trail | Flag lives in gitignored env files; clean-checkout test deploy runs cleanup OFF silently; no tracked artifact guarantees "test: true" | medium | defer | carried — same claim as pass-1 row 1, code unchanged (`.env.sample` note shipped); unfixable in-tree by repo-wide gitignore convention for all config; settles at deploy time per environment → `_bmad-output/seo-indexing/deferred-work.md` |

Patch applied for #11 (same implementer subagent, exact patch instructions): `INVALIDATION_RESERVE_MS=3000` capped at `min(3000, deadlineMs/4)`; on deadline stop an invalidation restricted to actually-deleted keys is issued within the reserve; `skipped-deadline` only when nothing was submitted (label semantics fixed); three deadline tests rewritten non-vacuous (deleted subset asserted against `invalidationPaths(result.deleted)`). Full Verification re-run after the patch: photo-delete-cleanup **24 passing**, lifecycle 17, crawler 29, inject-meta-tags 32, ts-standard clean on touched files, `cdk synth test` exit 0.

Review outcome (iteration 2): #11 patched and verified; #12 deferred to `_bmad-output/seo-indexing/deferred-work.md`. No intent gap — loop closed, proceeding to present.

## Plan Change Log — iteration 3 (2026-11-06, user-directed simplification)

- User decision: "keep the existing procedure structure, add delete json seo file as an extra step and also add the CDN invalidation" + explicit choice **B-in-mutation** with **no flag**. The separate `lambda-fns/utilities/photoCleanup.ts` module (deadline budget, invalidation reserve, injection scaffolding) is removed; the cleanup steps now live directly in `lambda-fns/controllers/photos/delete.ts` after `psql.clean()`: delete `<id>.webp`, `<id>-thumb.webp`, `<id>.mov`, then the seo sidecar via `deleteSeoSidecar`, then one wildcard CloudFront invalidation when `CLOUD_FRONT_DISTRIBUTION` is set.
- `PHOTO_DELETE_CLEANUP` kill-switch removed (user decision: unconditional cleanup). Accepted trade-offs: SDK default retry behavior runs inside wisawFn's 30 s budget with no explicit deadline, and there is no flag-level kill switch — the safety valve is the test-stack dry-run in `_bmad-output/seo-indexing/deferred-work.md`. The never-throws contract and per-step error isolation are kept.
- Deleting the thumb still fires the bucket's OBJECT_REMOVED notification, so the existing `processDeletedImage` cascade (its `_deleteSidecar` step included) remains the owner of table cleanup — the procedure structure is unchanged, deletePhoto only gained the storage+CDN steps.
- Deferred-work entry updated: per-env flag verification replaced by "dry-run on test stack first" (no flag exists anymore).
- Verification after simplification: `tests/photo-delete-cleanup.js` **13 passing** (flag-parsing and deadline rows dropped as the features were removed; key/path/sibling/failure-isolation/ordering contracts kept); seo-sidecar-lifecycle 17, seo-crawler-contract 29, inject-meta-tags 32; full suite 182 passing with only the 5 known `getSeasonBoundaries` failures; `tsc --noEmit` clean; ts-standard clean on touched files; `cdk synth test` exit 0 (grant still conditional on the distribution id).
