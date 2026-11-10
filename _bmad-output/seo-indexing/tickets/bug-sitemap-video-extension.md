---
id: 5
type: "bug"
title: "Sitemap video entries point at a .mov URL that may not exist"
parent: seo-indexing
covers: []
after: [3]
assignee: ""
refined: true
hitl: false
risk: medium
severity: P2
---

# Sitemap video entries point at a .mov URL that may not exist

## Description

Every video entry the sitemap publishes names a video file whose extension is assumed rather than looked up. The edge, which resolves the real stored object when it builds a page head, happily reports a different file for the same media. A video stored in any format other than the assumed one therefore gets a working page and a sitemap entry pointing at an object that was never written — search engines are told to fetch a missing file for a page they are being asked to index. The wanted outcome: the file named in the sitemap is the file that exists, and it is the same one the page itself advertises.

## Reproduction

1. List the videos bucket and group the stored objects by extension; note any video whose object is not `.mov`.
2. Read the published sitemap and take the video-file URL of one entry per extension found.
3. Request each of those URLs and record the status.
4. Compare each sitemap file URL with the video source the same page advertises in its head.

**Observed:** every sitemap entry names the assumed extension regardless of what is stored; any entry whose object uses another extension returns 404, and disagrees with the page's own advertised source.
**Expected:** every entry names the stored object, returns a non-404, and matches the page.

## Cause Hypothesis

The sitemap generator never consults storage: it builds media URLs from the media id plus a hardcoded extension that reflects how uploads used to be written. The edge resolves the real object by probing storage, and a third copy of the same naming rule lives in the upload path that produces thumbnails. Nothing pins the three together, so only the generator is wrong.

## Acceptance Criteria

1. Given a video whose stored object uses an extension other than the assumed one, when the sitemap is generated, then its entry names that stored extension and matches the video source advertised on the page itself.
2. Given the generated sitemap, when each video file URL of the first hundred entries is requested, then none returns 404.
3. Given a photo entry, when the sitemap is regenerated, then its image URL still resolves as it does today.
4. Given the extension rule needed by the sitemap generator and by the page head, then one rule answers both — or: no change is needed, with proof that every stored video really uses the assumed extension (the bucket listing from step 1 attached to this ticket).

## Boundaries

- The set of URLs the sitemap publishes does not change; only the correctness of each entry's media file is in scope.
- Page heads keep their current behaviour; the thumbnail URL rule is not reworked here.
- Nothing in the client app changes.

## References

- parent — `_bmad-output/seo-indexing/tickets/tickets.toml`
- validation — `_bmad-output/seo-indexing/validation-seo-head-consistency.md`, "Structural duplication (independent of values)" item 5
- tests — `tests/sitemap-image-text.js`, sitemap entry suite to extend
- decision — `_bmad-output/seo-indexing/.memlog.md`, 2026-11-07 sidecar lifecycle simplification, sidecar lives at the bucket root

## Notes

- Risk medium: a sitemap full of unreachable media URLs can cost video indexing on the site's only growth channel, but the fix is generator-side and reversible by republishing.
- Waits on seo-indexing/3 because: that ticket touches the same media text and metadata rules still in review; building beside it would collide.
- Assumption: resolving the extension at generation time by listing or probing storage is acceptable for the current corpus size — confirm before implementing if a per-object lookup turns out to be too slow.
- Operator dependency: step 1 of the reproduction needs a current videos-bucket inventory; ask the user to produce it if storage access is unavailable in the build environment.
- Operator step after build (not part of criteria): republish the sitemap and re-run step 3 against the live file.
