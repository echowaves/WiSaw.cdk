---
id: 2
type: bug
title: "A new photo has no SEO sidecar until up to five hours after upload"
parent: seo-indexing
covers: []
after: [1]
assignee: ""
refined: true
hitl: false
risk: medium
severity: P2
---

# A new photo has no SEO sidecar until up to five hours after upload

## Description

When a user uploads a photo, its page gets no SEO enrichment at first sight: the JSON sidecar for the photo appears only when the scheduled publisher next runs — up to about five hours later. The upload pipeline produces the image and its thumbnail and stops there. A new photo's sidecar should exist as soon as its thumbnail is produced, with the scheduled publisher still refreshing it after later edits.

## Reproduction

Deployed prod environment, 2026-11-07 (UTC); same behavior expected on any environment.

1. Upload a photo through the app — photo `78250028-d951-4095-93b5-cd033a29514e`.
2. In `wisaw-img-prod`, confirm `<id>.webp` (created 03:52:44) and `<id>-thumb.webp` (created 03:52:41).
3. Immediately check `seo/<id>.json`.

**Actual:** the sidecar key returns 404; the publisher watermark `seo/_last-run.json` shows the last successful run started 2026-11-06 20:04:01 — before the upload. The photo's page serves unenriched.
**Expected:** the sidecar exists within a minute of the thumbnail appearing.

## Cause Hypothesis

Only two things ever write sidecars: the scheduled sitemap publisher (five-hour cadence, selecting photos touched since its last run) and the manual backfill script. The upload processing that turns the raw upload into image and thumb contains no sidecar step at all — so every new photo waits for whichever of those runs next. (Evidence: S3 object timestamps above; plan-seo-sidecar-lifecycle's own statement of who writes sidecars.)

## Acceptance Criteria

1. **A newly uploaded photo has its sidecar as soon as processing completes**
   **Given** a photo uploaded on the deployed test environment
   **When** its thumbnail object appears in the media bucket
   **Then** `seo/<id>.json` exists within one minute and parses as JSON of the same fields and version the scheduled publisher writes, with caption empty until a later publisher run enriches it (labels and dimensions are written at upload — see Notes)
2. **A sidecar failure never breaks an upload**
   **Given** the sidecar write fails for any reason
   **When** the photo is uploaded
   **Then** the image, thumbnail, and app behavior are exactly as they are today — at worst the photo falls back to waiting for the scheduled publisher
3. **The scheduled refresh keeps working**
   **Given** the photo gets a caption after upload
   **When** the next scheduled publisher run completes
   **Then** its sidecar carries the new caption, as it does today
4. **Tests cover the condition found and fixed**
   **Given** the test suite
   **When** it runs
   **Then** a test that fails on the defect and passes on the fix covers the reproduction, and one covers each related case the fix touched — including criterion 2's failure path
5. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** the expected behavior already holds, or the report was mistaken, with the evidence recorded in Notes — this supersedes 1, 2 and 4

## Boundaries

- The sidecar key and body contract stays exactly as it is for all four parties that share it (scheduled publisher, backfill script, edge reader, reconciler); this ticket adds a writer only.
- Upload processing keeps its current jobs, timing, and outputs; the photo upload experience must not change or slow down because of the sidecar step.
- The scheduled publisher keeps its window-and-watermark behavior unchanged — the upload-time write supplements it, never replaces it, so later edits still refresh the file.
- The no-coordinates guard applies to every new write: a sidecar whose location is a coordinate rather than a place name must never be published.
- A thinner upload-time sidecar must never replace a richer existing one — re-processing an already-captioned photo leaves the fuller file alone.
- Nothing is written for a photo that is deleted or inactive: an upload-time write racing a delete must not resurrect a sidecar ticket 1's cleanup removed.

## References

- parent — none
- decision — docs/decisions/adr-seo-sidecars-in-media-bucket.md, sidecar key/body contract and its parties
- plan — _bmad-output/plan-seo-sidecar-lifecycle.md, Intent (who writes sidecars today)
- evidence — S3 head-object checks on wisaw-img-prod, 2026-11-07: keys and timestamps as in Reproduction; watermark lastRunStart 2026-11-06T20:04:01Z
- tests — tests/seo-crawler-contract.js and tests/seo-sidecar-lifecycle.js, existing sidecar contract and lifecycle harnesses to reuse

## Notes

- Decision: the upload-time sidecar may be minimal — location and date only; captions and labels arrive with the scheduled publisher's later refresh. (User, 2026-11-06)
- Decision: risk medium (every new photo's path changes; a wrong sidecar affects one page and self-heals on the next publisher run), severity P2 (enrichment arrives within ~5h today). (User, 2026-11-06)
- Decision: at thumb time the photo's row already exists with its location fields, so the upload-time sidecar can carry them; a missing row falls back to the publisher path and never fails the upload. (User confirmed, 2026-11-06)
- Decision: this ticket is ordered after entry 1 — both edit the sidecar module and its delete path. (User, 2026-11-06)
- Decision: the upload path becomes a named writer of the sidecar contract; the ADR gains a dated line saying so as part of this work. (User, 2026-11-06)
- Superseded at build: "captions and labels arrive with the scheduled publisher's later refresh" — the writer must read the full row (`seoSidecar.ts` forbids thin writers), and labels/dimensions are already in the DB at write time, so they ship at upload; only the caption stays empty until the next publisher run. (Build, 2026-11-07; plan's frozen I/O matrix row 1.)
- Forcing criterion 2's failure on the test stack: make the sidecar write throw there — e.g. temporarily deny the processing role's PutObject on `seo/*` — then upload and confirm image, thumb, and app behavior are unaffected.

## Notes (addendum)

- 2026-11-07: sidecar key moved from `seo/<id>.json` to bucket-root `<id>.json` (`sidecarKey()`), and the upload writer now shares `loadSeoPhotoRow()` with the comment-refresh path, so upload and comment edits publish identical bodies. Behaviour and failure semantics of this ticket are unchanged.
