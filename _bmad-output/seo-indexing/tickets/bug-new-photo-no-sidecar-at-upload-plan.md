---
title: 'Write the SEO sidecar at upload processing time'
type: 'bugfix'
ticket: '2'
created: '2026-11-07'
status: 'built'
baseline_revision: '5d2c59177561c3d7e0657caf3d70ee445d246645'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiated">

## Intent

**Problem:** A new photo gets its `seo/<id>.json` sidecar only when the 5-hour scheduled publisher or a manual backfill runs, so brand-new pages serve unenriched for hours (reproduced on prod 2026-11-07: thumb at 03:52Z, sidecar absent).

**Approach:** The upload processing that already turns `<id>.upload` into webp + thumb gains one final step: read the photo's full row and write its sidecar through the existing contract module. The scheduled publisher keeps running unchanged as the refresh path for later edits.

## Boundaries & Constraints

**Always:** build every sidecar through `buildSeoSidecar`/`putSeoSidecar` in `seoSidecar.ts` (the header demands every writer go through it); read the photo row fresh at write time with its active filter, so a deleted or inactive photo is skipped by construction; swallow any sidecar error inside the new step — upload processing outcome must be byte-identical to today when the write fails; await the write before returning so it lands within seconds.

**Never:** no changes to `lib/resources/buckets.ts` (grants already cover this), `generateSiteMap`, `processDeletedImage`, `controllers/photos/delete.ts`, or the sidecar body/key contract; no new dependencies; no change to thumb/webp/recognize behavior, timing, or ordering before activation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy upload | row active, recognitions inserted, dimensions set | `seo/<id>.json` PUT with v1 body: location + created + width/height + labels present, caption empty | n/a |
| Row gone or inactive | delete raced the upload (`active=false` or hard-deleted) | no sidecar written; upload still completes | skip silently (log) |
| S3 PUT fails | PutObject throws | upload completes exactly as today; `main()` still returns true | error logged, swallowed |
| Coordinates leak | row's address columns would produce a coordinate location | `assertNoPreciseLocation` throws → no write | error logged, swallowed |
| Row missing entirely | activate never happened (DB raced) | SELECT returns 0 rows → no write | skip silently (log) |

</frozen-after-approval>

## Code Map

- `lambda-fns/lambdas/processUploadedImage/index.ts` — THE change site. `main()` L15: derives `photoId` from `<id>.upload` Key (L25); first `Promise.all` L53-57 generates `${photoId}-thumb.webp`, `${photoId}.webp`, `_recognizeImage` (inserts Recognitions), `_extractImageDimensions`; second `Promise.all` L63-65 runs `_deleteUpload` + `_activatePhoto` (UPDATE active=true, updatedAt; swallows its own errors); then psql block L69-80 SELECTs the row for grouping. Add exported `_writeSeoSidecar({ Bucket, photoId })` called after that second `Promise.all`, reusing the already-connected `psql`; helpers use `new S3Client({ region: 'us-east-1' })` — copy that pattern.
- `lambda-fns/utilities/seoSidecar.ts` — reuse only, do not modify: `putSeoSidecar(client, bucket, photo)` L119 (key via `sidecarKey`, body via `buildSeoSidecar`, CacheControl max-age 60); `buildSeoSidecar` reads createdAt, lastComment, labels[], address columns via `locationText`, width/height; `assertNoPreciseLocation` throws on coordinate-looking output.
- Row shape to mirror: generateSiteMap's query (`generateSiteMap/index.ts` L71-84) — `SELECT p.*, COALESCE(r.labels,'[]'::jsonb) AS labels` with the Recognitions lateral; here add `WHERE p."id"=$1 AND p.active = true LIMIT 1`.
- `lib/resources/buckets.ts` L31-34 — processUploadedImage already has grantReadWrite/grantPut/grantDelete on the img bucket. **Do not change.** env for this lambda carries no S3_BUCKET; take Bucket from the event like every other step here does.
- `tests/seo-sidecar-lifecycle.js` / `tests/photo-delete-cleanup.js` — harness to copy: ts-node transpile-only hook, .pem require-cache stub before importing psql-touching modules, patched `S3Client.prototype.send`.

## Tasks & Acceptance

**Execution:**
- [ ] `lambda-fns/lambdas/processUploadedImage/index.ts` — add exported `_writeSeoSidecar({ Bucket, photoId })`: own try/catch (never throws); connect psql, SELECT the full row per the Code Map shape; 0 rows → log+return; else `putSeoSidecar(new S3Client({region:'us-east-1'}), Bucket, row)`; await it in `main()` after the activate/delete Promise.all and before the grouping block's return path — full-row read means a re-upload can never thin a captioned sidecar
- [ ] `tests/upload-seo-sidecar.js` (new) — copy harness header; unit-test `_writeSeoSidecar`: active row → PutObject to `seo/<lowercase-id>.json`, ContentType application/json, body v1 with empty caption and non-empty location/created; inactive/missing row → no PUT; send throws → function resolves without throwing. Plus one main()-level test: stub S3Client.send (GetObject returns a 1x1 buffer generated in-test via sharp) and psql, assert on a successful upload a PutObject for the sidecar key occurs, and with PutObject(sidecar) throwing `main()` still returns true — this test fails today (no PUT exists)
- [ ] `tests/upload-seo-sidecar.js` — ordering guard: assert no sidecar PUT is recorded before the UPDATE to active=true completes (psql stub records call order)

**Acceptance Criteria:** ticket 2's criteria 1–5; criterion 1's one-minute window is proven by the main()-level test plus manual check below.

## Implementation Notes

Route full: ~40 lines of product code but ~150+ lines of new tests with stubbing scaffolding (>100 LOC). Labels/dimensions are already in the DB at write time because `_recognizeImage`/`_extractImageDimensions` complete in the first Promise.all. Caption is legitimately empty at upload; the publisher refresh enriches it later (user decision 2026-11-06).

Review round 1 added a resurrection guard: after the PUT, the row is re-checked and a sidecar whose photo went inactive meanwhile is deleted again. deletePhoto commits `active=false` before deleting any object, so a post-write check provably closes the SELECT↔PUT window; the cleanup-s3 reconciler stays the backstop if the recheck itself fails.

## Plan Change Log

## Review Triage Log

| # | Finding (Quick lens) | Verdict | Evidence & route |
|---|----------------------|---------|------------------|
| 1 | ADR not updated though ticket Notes require a dated line naming the upload writer | medium — patch | Verified: ADR line 7 still said "two writers"; ticket Notes L82 required the amendment. Added dated amendment paragraph to `docs/decisions/adr-seo-sidecars-in-media-bucket.md`. |
| 2 | Delete committing between the sidecar SELECT and PUT can resurrect a cleaned-up sidecar; ticket boundary says never | medium — patch | Verified real: window exists; publisher never removes it. deletePhoto commits active=false (delete.ts L116) before cleanupPhotoObjects (L132), so a post-PUT recheck + conditional DeleteObject closes the window. Guard added in `_writeSeoSidecar` + unit test "delete commits between the SELECT and the PUT". |
| 3 | Ticket AC1 says labels empty until publisher refresh; shipped behavior writes labels at upload | low — patch | Verified: frozen I/O matrix row 1 ("labels present") is authoritative and thinning would violate seoSidecar.ts's no-thin-writers rule. Amended ticket AC1 wording and added a dated supersession note to Notes. |
| 4 | `captureConsole()` restores only on the happy path; a failing assertion leaves console monkey-patched for the whole mocha process | low — patch | Verified: copied harnesses use try/finally or tracked patches. All call sites now route through `watchConsole()` which registers restore in the `afterEach`-driven map. |
| 5 | Duplicated assertion + restore lines in "psql read itself fails" | low — patch | Verified at L194–197 (leftover from an edit round-trip); deduped while converting that test to `watchConsole()`. |
| 6 | `psql.clean()` skipped when the sidecar SELECT throws, against file-wide helper convention | low — patch | Verified: every sibling helper cleans after its try/catch; clean() is a safe no-op without a client. Query moved into try/finally around clean. |

All six routed `patch` (trivial, part of this diff); no intent_gap/bad_plan → no loopback. Patched by the main session — the step-03 implementation subagent's model backend was unavailable for re-engagement.

## Verification

**Commands:**
- `npx mocha --exit --require @babel/register tests/upload-seo-sidecar.js` — expected: all pass
- `npx mocha --exit --require @babel/register tests/seo-sidecar-lifecycle.js && npx mocha --exit --require @babel/register tests/seo-crawler-contract.js && npx mocha --exit --require @babel/register tests/photo-delete-cleanup.js` — expected: unchanged pass (17/29/13)
- `npx tsc --noEmit` — expected: clean
- `npx ts-standard lambda-fns/lambdas/processUploadedImage/index.ts tests/upload-seo-sidecar.js` — expected: clean (repo-wide lint has pre-existing failures; measure per file)
- `npm test` — expected: no new failures beyond the 5 known getSeasonBoundaries ones

**Manual checks:**
- After deploy to test: upload a photo, then within ~60 s `aws s3api head-object --bucket wisaw-img-test --key seo/<id>.json` → exists; body parses with v1 fields.
