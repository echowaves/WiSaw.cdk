---
id: 1
type: bug
title: "Deleting a photo leaves its images and SEO files live in storage"
parent: seo-indexing
covers: []
after: []
assignee: ""
refined: true
hitl: true
risk: high
severity: P1
---

# Deleting a photo leaves its images and SEO files live in storage

## Description

When a user deletes their photo, it vanishes from every list and page in the app — but the uploaded image, its thumbnails, and the photo's SEO sidecar file stay in the media bucket. Anyone holding the direct link can still open the deleted photo, and the objects pile up forever. A cleanup path exists but fires only on a storage event no user action produces; today only an operator running a manual script clears these objects. Deleting a photo must remove all of that photo's objects and stop them serving within one hour; before removal is enabled in prod, an operator dry-runs the matcher against a bucket inventory (the human step this ticket requires).

## Reproduction

Deployed test environment, a real account.

1. Upload a photo through the app. Record its page URL, its direct image URL, a thumbnail URL, and confirm its sidecar object `seo/<id>.json` exists in the `wisaw-img-<env>` bucket.
2. Delete the photo from the app. Confirm it is gone from the app's lists and pages.
3. Fetch the three recorded URLs and list the sidecar key.

**Actual:** the image, thumbnail, and sidecar all still serve (HTTP 200); the bucket still holds every object. The database row was only marked inactive.
**Expected:** after caches expire, every one of the photo's objects is gone (403/404), and none remain in a bucket listing.

## Cause Hypothesis

The delete mutation flips a visibility flag in the database and touches no storage object. The bucket-event cleanup for a deleted photo fires only when a thumbnail object is removed — an event nothing in the app produces; only the manual operator script deletes objects today. So no user-facing path ever triggers removal, of the media or of the sidecar. (Evidence: research sections 3–4.)

## Acceptance Criteria

1. **A user delete removes every object belonging to that photo**
   **Given** a photo uploaded on the deployed test environment, with its image, thumb, and sidecar URLs recorded
   **When** at most one hour has passed since the user deleted the photo
   **Then** the original image, all of that photo's thumbnails, and the `seo/<id>.json` sidecar return 403/404 through the public URLs, a bucket listing shows none of them, and the photo is absent from the app
2. **Other photos' objects are untouched**
   **Given** two photos whose stored keys share a prefix
   **When** one of them is deleted as above
   **Then** the other photo's image, thumbs, and sidecar still serve, and its indexed page still renders its SEO-enriched title and description
3. **Tests cover the condition found and fixed**
   **Given** the test suite
   **When** it runs
   **Then** a test that fails on the defect and passes on the fix covers the reproduction, and one covers each related case the fix touched — including that a delete never matches another photo's keys
4. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** the expected behavior already holds, or the report was mistaken, with the evidence recorded in Notes — this supersedes 1 and 2

## Boundaries

- The sidecar key and body contract stays exactly as it is for all four parties that share it (scheduled publisher, backfill script, edge reader, reconciler); this ticket changes removal only, never key or body shape.
- Removal matches that photo's exact object set — never a broad prefix sweep of the bucket.
- SEO edge injection stays byte-exact: the existing crawler-contract tests keep passing unchanged, and pages for photos not deleted are unaffected.
- The delete response and the GraphQL API stay as mobile clients know them.

## References

- parent — none
- research — _bmad-output/seo-indexing/research-seo-edge-injection-and-sidecar-lifecycle/research-seo-edge-injection-and-sidecar-lifecycle.md, "In one breath", sections 3–4 and "Where the answers meet"
- decision — docs/decisions/adr-seo-sidecars-in-media-bucket.md, sidecar key/body contract and its four parties
- tests — tests/seo-sidecar-lifecycle.js, existing lifecycle harness to extend

## Notes

- Decision: cleanup removes all of the photo's S3 objects — original, thumbs, sidecar — at delete time; not deferred, not sidecar-only. Risk high, severity P1. (User, 2026-11-06)
- High-risk check beyond criteria (the human step named in Description): before enabling removal in prod, an operator runs the matcher in dry-run against a current bucket inventory and confirms it selects only keys of already-deleted photos.
- Decision: "deleted" means the user-facing photo delete; account-deletion and admin purge flows are out of scope for this ticket. (User, 2026-11-06)
- Decision: the media CDN caches deleted URLs for up to 10 days (max-TTL policy), so removing the objects alone leaves cached copies serving; the fix must also invalidate the removed keys, and AC1's window is one hour. (User, 2026-11-06)
- The earlier plan `_bmad-output/plan-seo-sidecar-lifecycle.md` claimed this lifecycle was complete; the research disproved that for user deletes. Context only, not evidence.
- **REVERSED 2026-11-07 (user decision, do not re-implement)**: `deletePhoto` goes back to soft-delete only — it flips `Photos.active = false` and touches no object. Deleting storage from a user-facing mutation lets a buggy or abused client wipe the corpus; a flag flip is restored by flipping it back. Removal stays where it was: an operator deletes the objects (S3 triggers are managed by hand, not in CDK), and `processDeletedImage` — fired by the `<id>-thumb.webp` delete event — removes the sidecar and invalidates `/<id>*` on the img distribution so a genuinely removed photo stops serving. AC1/AC2 above describe the withdrawn behaviour; the commit is documented in the ADR amendment "sidecar lifecycle simplification".
