---
id: 9
type: "story"
title: "A newly uploaded video states no length until a later pass touches it"
parent: seo-indexing
covers: []
after: [8]
assignee: ""
refined: true
hitl: true
risk: medium
---

# A newly uploaded video states no length until a later pass touches it

## Description

A video that has just been uploaded publishes its page with no length at all, and only acquires one when something else happens to touch it — a comment, the bounded scheduled learning pass (150 videos per run), or an operator running the backfill script. Learning the length must move into upload processing, so the first record published for a brand-new video already states it.

This closes the last gap left open by entry 8. That entry built everything the fact needs — the container parser, the learner that reads one row's object and stores what it finds, the column, the API field, and every surface that renders it — but it deliberately chose three moments at which a container gets read, and upload was not one of them. So the corpus is covered while new uploads are not: the newest video on the site is the one video whose page cannot qualify for video rich results on account of its length, and it stays that way until an unrelated event reaches it.

Upload processing is where this belongs because it already reads a fact off the stored bytes and writes it to the row in the same invocation, and because it publishes the enrichment record as its last step — so a duration learned there reaches the page without waiting for anything. The user set this hook point directly: the function triggered by the upload event, at the same time the thumbnail is generated, with no log confirmation of the upload path sought first (see Notes).

Two steps in criterion 1 belong to a person rather than to the build: deploying the changed function to the test stack, and recording plus uploading a video through the real app.

## Acceptance Criteria

1. Given a video recorded and uploaded through the real app on the deployed test environment, when its upload processing has finished, then its row already states the length read from its stored video object — with no operator script run and no scheduled learning pass in between — within the same window in which its thumbnail appears.
2. Given that same video, when its enrichment record is published by that same processing, then the record carries the length, so the page states it on the first publish instead of waiting for a comment or a scheduled run.
3. Given the upload of anything that is not a video, or of a video whose container does not state a length, when processing finishes, then no duration is recorded anywhere and the published record is byte-identical to the one today's code publishes for an unmeasured video — never `0`, never an estimate.
4. Given the duration step fails for any reason — the video object missing, its container unreadable, the probe out of time — when that upload completes, then the image, thumbnail, activation and enrichment write behave exactly as they do today, and at worst that one video waits for an existing path.
5. Given processing is triggered by bytes that are a still poster rather than the video itself, when the length is taken, then it comes from the stored video object belonging to that media id, and never from the triggering bytes, file size, bitrate or upload time.
6. Given a row that already states a length, when another upload for the same id is processed, then nothing is probed again and the stored answer is left alone — no repeat cost, no second opinion overwriting a measurement.
7. Given the test suite, when it runs, then a case that fails before this change and passes after covers a video acquiring its length during upload processing, one covers criterion 4's failure path, and `npm test` reports no failures beyond the five known getSeasonBoundaries ones.

## Boundaries

- Touch point: upload processing — gains one step beside the thumbnail, labelling and dimension work it already does; owner: seo-indexing (this entry).
- Must not change: what triggers that processing (the object-created event filtered to the upload suffix), its stack wiring, or its permissions. No new trigger, function or grant is in scope here — if a video upload turns out to need one, that is a replan back to Sofia rather than growth inside this ticket.
- Must not change: learning writes the length only and deliberately leaves `updatedAt` alone, as entry 8 decided; bumping it would push every probed video back into the sidecar refresh window on each run.
- Unknown stays absent everywhere: no key in the record, no tag in the head, no property in the structured data — never `0`, which reads as "this video is instantaneous".
- Records for videos nobody has measured stay byte-identical to what entry 8 publishes today.
- The edge still never parses a container while answering a crawler request; it uses the number in the record.
- No migration, no schema change, no mobile app change, and no change to the enrichment record's key or versioning contract — the column, parser, learner and formatting rules all exist from entry 8.
- The three existing learning moments keep working unchanged: the comment refresh, the bounded scheduled pass, and the operator backfill. This adds a fourth moment for the same fact; it must reuse them, never become a second copy of the rule.
- A photo's upload keeps its current timing and outputs — nothing about uploading a still image may slow down or change because of this step.

## References

- parent — `_bmad-output/seo-indexing/tickets/tickets.toml`
- story — `_bmad-output/seo-indexing/tickets/story-real-video-duration.md`, Acceptance Criteria and Boundaries: the invariants this entry must not break, and the learner it reuses
- decision — `_bmad-output/seo-indexing/.memlog.md`, 2026-11-11 ticket 9 entries (hook point, upload path, risk and hitl) and the 2026-11-11 duration entries (where a container gets read, what the write must not touch)
- app — `../WiSaw/src/screens/PhotosList/upload/photoUploadService.js`, `uploadItem` and `genLocalThumbs` in the sibling app repo: video bytes are stored as `<id>.mov` first, then a locally generated poster image is stored at `<id>.upload`, after the row has been created with its video flag set
- evidence — `_bmad-output/seo-indexing/evidence/duration-container-probe-2026-11-11.txt` (40 of 40 sampled videos answered; ≈665 KB and 3 ranged reads plus 1 HEAD each), `_bmad-output/seo-indexing/evidence/videos-bucket-inventory-2026-11-10.txt` (842 stored videos, no upload-stage objects left behind in production)
- tests — `tests/video-duration.js` (container parser, rules, record shape, write path), `tests/upload-seo-sidecar.js` (the upload-time writer harness this entry extends)

## Notes

- Risk medium: it sits in the path every media upload runs through. It is best-effort by design, though — a failed or wrong probe costs one video its duration until an existing path heals it, and nothing user-facing breaks.
- hitl: two named human steps in criterion 1 — deploy the changed processing function to the test stack, then record and upload a video through the real app and report what the row and the published record say. This agent runs neither the deploy nor the app.
- Waits on seo-indexing/8 because: entry 8 owns the storage column, the container parser and the learner this entry calls; before it there is nowhere to store or read a length.
- Decision 2026-11-11 (User): the hook point is the function triggered by the upload event, learning at the same time the thumbnail is generated; confirming the video upload path from logs first was declined — "the hook point should be obvious".
- Discovery 2026-11-11 (Agent): the upload-path question this ticket was drafted around is answered by the app's own code rather than by logs. A video capture uploads its bytes to `<id>.mov` first and then always uploads a locally generated poster image to `<id>.upload`, with the row already created and flagged as a video. So the upload event does fire for videos, the bytes handed to processing are an image rather than video data, and the `.mov` is already stored by the time processing runs — which is why this stays a change inside the existing function instead of new trigger work.
- Open question: confirm on the deployed test environment, as build step 1 and before any edit, that a real video upload does invoke the upload processing at all — its log line for that id, and criterion 1's row read afterwards. If no upload event turns out to fire for videos, this ticket is no longer a change inside one function: it becomes a new trigger with stack wiring and permission work, and comes back here as a replan rather than growing in place.
- Assumption: the test environment accepts an app video upload within the verification window, because the mobile build points at the test stack. If it cannot, criterion 1 stays a live check but moves to production alongside the operator, still a human step.
- Known hazard, deliberately not fixed here: if any client ever stored raw video bytes at the upload key, today's thumbnail step would throw on them inside an unguarded parallel batch and the invocation would die before the photo is activated. That behavior predates this ticket and is out of scope; criterion 1's live check surfaces it at once if another client does that.
- Cost is bounded and already measured: one probe per row for the life of that row, since a row that states a length is skipped — ≈450 ms, ≤3 ranged reads plus 1 HEAD, ≈665 KB per video (see the evidence above). It lands inside an invocation that already downloads and re-encodes the upload.
- Deployment shape: backend only. No migration is needed — the column exists from entry 8 — and no Lambda@Edge function is touched, so this one can be verified from the test stack, unlike the edge-side entries.
