---
title: 'SEO sidecars follow the photo lifecycle in S3'
type: 'bugfix'
ticket: ''
created: '2026-11-06'
status: 'built'
baseline_revision: 'd793fcbac17c39e2874587882e0dba01642fe71a'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `seo/<id>.json` sidecars are written by the sitemap publisher and the backfill script, but nothing in the system ever deletes them. S3 expiry on `wisaw-img-prod` is one blanket 10,000-day rule shared with photo objects, so object lifetime is effectively "never" and sidecar cleanup cannot rely on it. Orphans therefore accumulate for every photo that is hard-deleted, and the only reconciliation tool in the repo (`npm run cleanup-s3`) classifies *every* key that does not start with a UUID as junk — so a live run today deletes all ~22k sidecars plus `seo/_last-run.json`, which silently strips caption text from every photo page at the edge.

**Approach:** Make a sidecar's lifetime follow the media it describes: delete it wherever the photo's objects and row are actually destroyed, and make the reconciliation tool prefix-aware so it prunes only sidecars whose photo is gone and never deletes `seo/` keys it does not understand.

## Decisions (settled with the human at planning)

- Soft-deleted photos (`active=false`) **keep** their sidecars; only the hard-delete path and reconciliation prune them.
- The `cleanup-s3.js` guard **is in scope**, and it prunes already-orphaned sidecars in the same pass rather than only preventing new ones.
- Photo path only: no video thumbnail trigger is added here.
- Verification gate is unit tests + `tsc --noEmit` + lint; the prod `cleanup-s3:dry-run` stays a manual check.
- The `<id>` vs `<id>.webp` media-delete bug stays out of scope and is recorded as follow-up.

## Boundaries & Constraints

**Always:** build the key only through `sidecarKey()` in `seoSidecar.ts`, never a hand-written string at a call site; treat an already-absent sidecar as success (S3 delete is idempotent); never let a sidecar delete failure fail the enclosing handler — log and continue, matching the existing `_deleteUpload` pattern; keep `cleanup-s3` dry-run semantics and its existing photo-object rules unchanged; prove every delete path with a mocha test.

**Never:** no changes to bucket lifecycle config or CDK (the media bucket is imported via `fromBucketName`, so expiry stays out of IaC); no change to soft-delete semantics in `controllers/photos/delete.ts` (`active=false`, media objects stay); no deletion of photo/video media objects; no new dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / state | Expected behavior | Error handling |
|---|---|---|---|
| Hard delete | `<id>-thumb.webp` removed → `processDeletedImage` runs | `DeleteObject` for `seo/<id>.json`; DB cleanup unchanged | sidecar delete throws → logged, handler still returns `true` |
| Already gone | sidecar absent | no-op success | `NoSuchKey` is not an error |
| Reconcile, live photo | `seo/<uuid>.json`, row `active=true` | kept | n/a |
| Reconcile, photo gone | `seo/<uuid>.json`, no active row | marked for deletion | delete failure logged, loop continues |
| Reconcile, non-photo key | `seo/_last-run.json` or any unrecognized non-UUID key | reported, **never deleted** (today it is) | n/a |

</frozen-after-approval>

## Code Map

- `lambda-fns/utilities/seoSidecar.ts` — sole owner of the sidecar contract: `sidecarKey()` L72 (lowercases the id), `putSeoSidecar` L76, `putSeoSidecars` L91, `SEO_WATERMARK_KEY` L106. Header comment already demands every writer go through this module.
- `lambda-fns/lambdas/processDeletedImage/index.ts` — OBJECT_REMOVED handler (trigger filter `suffix: '-thumb.webp'`, set in `lib/resources/buckets.ts` L52-57). `photoId` derived at L16; `_deleteUpload` L35-59 is the S3-client + swallow-the-error pattern to copy; `_cleanupTables` L63 hard-deletes rows.
- `scripts/cleanup-s3.js` — `extractPhotoId` L85 anchors its UUID regex at `^`, so every `seo/…` key yields `null` and lands in `toDelete` via the `unknownObjects` branch at L126-131; dry-run gate L146.
- `tests/seo-crawler-contract.js` — style reference for asserting on SEO code; `tests/is-location-in-wave.js:6` proves a `.ts` module under `lambda-fns/utilities/` can be required directly from a JS test under `@babel/register`.
- `lib/resources/buckets.ts` — **do not change**; grants and notification filters. Its L36 comment is why expiry cannot live in code.
- `lambda-fns/controllers/photos/delete.ts` — **do not change**; user delete is a soft delete (L35-39) that touches no S3 object, so no sidecar work belongs there.

## Tasks & Acceptance

**Execution:**
- [x] `lambda-fns/utilities/seoSidecar.ts` — add exported `deleteSeoSidecar(client, bucket, id)` built on `sidecarKey()` -- keeps the key contract in one module so call sites cannot drift.
- [x] `lambda-fns/lambdas/processDeletedImage/index.ts` — run `deleteSeoSidecar` alongside `_deleteUpload`/`_cleanupTables`, swallowing errors as `_deleteUpload` does -- closes the event-driven orphan path.
- [x] `scripts/cleanup-s3.js` — replace the inline classification with a pure exported classifier: `seo/<uuid>.json` → delete only when no active row owns that id; any other non-UUID key (including `seo/_last-run.json`) → report, never delete -- stops the mass-delete and prunes pre-existing orphans in the same pass.
- [x] `tests/seo-sidecar-lifecycle.js` — new mocha file covering the I/O matrix rows and that `deleteSeoSidecar` targets `seo/<id>.json` with a lowercased id.

**Acceptance Criteria:**
- Given a photo whose thumb object is removed, when `processDeletedImage` runs, then `DeleteObject` is issued for `seo/<id>.json` and the handler still returns `true` when that call fails.
- Given `cleanup-s3` classifying a bucket holding `seo/<live-uuid>.json`, `seo/_last-run.json` and `seo/<gone-uuid>.json`, then only the last is marked for deletion.
- Given a live `npm run cleanup-s3` after this change, then no `seo/` key belonging to an active photo is deleted.
- Given `npm test`, then no new failures beyond the 5 known `getSeasonBoundaries` timezone failures on main.

## Implementation Notes

- `deleteSeoSidecar` added at [../lambda-fns/utilities/seoSidecar.ts](../lambda-fns/utilities/seoSidecar.ts) beside the writers; `_deleteSidecar` added to [../lambda-fns/lambdas/processDeletedImage/index.ts](../lambda-fns/lambdas/processDeletedImage/index.ts) and run in the existing `Promise.all`.
- [../scripts/cleanup-s3.js](../scripts/cleanup-s3.js) is now require-safe: env config, the S3 client and the DB connection moved inside `main()`, and `main()` runs only under `require.main === module`. Needed so the classifier can be unit-tested; runtime behaviour is unchanged apart from the classification fix.
- The `ts-node/register/transpile-only` hook in [tests/seo-sidecar-lifecycle.js](../tests/seo-sidecar-lifecycle.js) is load-bearing, not decoration: `processDeletedImage` imports `"../../psql"` with no extension, which neither `@babel/register` nor Node 24's own type stripping resolves. Removing the hook fails the file with `ERR_MODULE_NOT_FOUND`.
- **Correction to `## Verification`:** `npm run lint` is not a usable gate here — it already fails on `main` with pre-existing violations repo-wide, including ~40 in `processDeletedImage/index.ts`. Measured per file instead: `seoSidecar.ts`, `cleanup-s3.js` and the new test file are clean, and none of the findings reported in `processDeletedImage/index.ts` fall inside the added block.
- Worth knowing before running reconciliation: it prunes sidecars for `active=false` photos as well, because `getPhotoIds()` selects `active = true` only. That is consistent with the same pass already deleting those photos' `<uuid>.webp` media; the human decision to keep sidecars on soft delete governs the event-driven path, not reconciliation.
- The prod `cleanup-s3:dry-run` manual check was not run: it needs `.env.prod` and network reachability to RDS.

## Plan Change Log

## Review Triage Log

Pass 1 — lens `quick` (1 launched, 1 reported): 0 high, 0 medium, 3 low.

| # | Verdict | Route | Location | Finding | Evidence |
|---|---------|-------|----------|---------|----------|
| 1 | low | rejected | `lambda-fns/lambdas/processDeletedImage/index.ts:24` vs `lambda-fns/lambdas/generateSiteMap/index.ts` | A sidecar re-PUT by an in-flight publisher run can land after the new delete, resurrecting an orphan. | Real race, but reaching it needs a `-thumb.webp` object removal (the only trigger for `_deleteSidecar`, and today that happens only during a manual reconciliation, never from user action — users soft-delete) to coincide with one 5-hourly publisher run's snapshot→PUT window. Outcome is a single stale `seo/<id>.json`, which the next reconciliation pass prunes; it is no worse than the pre-change steady state. Rejected per the low-finding rule: unlikely in everyday use, and closing it means adding an existence re-check guard inside the publisher. |
| 2 | low | patch | `tests/seo-sidecar-lifecycle.js` (top of file) | The `.pem` require-cache stub is never removed, so it leaks to any later-loaded test that pulls in `psql.ts`. | Confirmed: no teardown exists for it, unlike the `S3Client.prototype` / `console.error` patches. Harm is currently latent — `tests/season-key.js:90` documents avoiding `psql` precisely because of this PEM import, and `_isWaveFrozen.ts` / `_isWaveDateFrozen.ts` (loaded later by `tests/wave-lock-mode.js`) do not import it. Kept because the fix is a direct correction in this change's own test file. |
| 3 | low | patch | `tests/seo-sidecar-lifecycle.js`, first `processDeletedImage` case | `expect(photoDeletes).to.include(LIVE)` pins `_deleteUpload`'s wrong media key (`<id>`, not `<id>.webp`) as expected behaviour, so the deferred fix will break this test. | Confirmed at the assertion and at `_bmad-output/deferred-work.md`. Not needed by any acceptance criterion in this plan — the sidecar delete is asserted separately. Kept because deleting the assertion is a direct deletion. |

## Design Notes

The classifier is a pure function `(key, activeIds) => 'keep' | 'delete' | 'report'` so the dangerous branch is testable without S3 or Postgres:

```js
seo/8f2a….json  + id active   → keep
seo/8f2a….json  + id inactive → delete
seo/_last-run.json            → report (was: delete)
deadbeef.webp   + id inactive → delete   // existing photo rule, unchanged
```

Deliberately untouched: `processDeletedImage` deletes key `<id>` while every reader uses `<id>.webp` (`lambda-fns/models/photo.ts:25`), so the original media object is never deleted. That is a storage-hygiene bug with its own blast radius (videos, restore semantics) and belongs to a separate change.

## Verification

**Commands:**
- `npx mocha --exit --require @babel/register tests/seo-sidecar-lifecycle.js` -- expected: all green
- `npx mocha --exit --require @babel/register tests/seo-crawler-contract.js` -- expected: 55 assertions still green
- `npx tsc --noEmit` -- expected: no errors
- `npm run lint` -- expected: ts-standard clean

**Manual checks:**
- `npm run cleanup-s3:dry-run` (needs `.env.prod` + VPN): the "Non-UUID objects (will be deleted)" count must drop to 0 for `seo/` keys, and no active photo's sidecar may appear in the delete list.
