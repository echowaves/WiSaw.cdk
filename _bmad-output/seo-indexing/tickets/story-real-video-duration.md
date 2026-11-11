---
id: 8
type: "story"
title: "Real video duration never reaches a page or its structured data"
parent: seo-indexing
covers: []
after: [4]
assignee: ""
refined: true
hitl: false
risk: medium
severity: P3
status: built
---

# Real video duration never reaches a page or its structured data

## Description

As someone trying to surface this site's videos in search results, I want each video page to state how long the video actually is, so the page can qualify for video rich results and so nothing on the page has to guess.

Raised while resolving ticket 4. The fabricated duration there was replaced by removing it rather than fixing it, because no real value could reach the page: the fact existed only as an object-metadata read that one edge path made and then discarded into a log line, and neither the database, the enrichment record nor the API had anywhere to put a duration. Every consumer that wants one — video rich results, the sitemap's duration field, a player's advertised length — either omitted it or invented one. Refinement found the premise behind the original wording ("upload-time object metadata") false in production, so the real value is now read out of the stored container itself; see criteria 1 and the Notes.

## Acceptance Criteria

1. Given a video whose stored container states a length, when its enrichment record is written, then the seconds read from that container are stored with the row and published in the record — never a number derived from file size, bitrate or upload time.
2. Given a media item the app requests, when the GraphQL response is built, then it carries that duration as a whole number of seconds, and a video nobody has measured yet carries no duration rather than `0`.
3. Given a video page, cold (Lambda@Edge) and hydrated (the app), when either renders it, then `og:video:duration` states whole seconds and the `VideoObject` `duration` states the same measurement in ISO 8601; the sitemap's entry for that video states the same number of seconds; and every one of those is absent rather than guessed when the length is unknown.
4. Given media recorded before this change, when its page or record is produced, then it keeps everything it has today — a record whose duration is still unknown is byte-identical to the record published before this ticket — and shows no duration until one has been measured.
5. Given the existing corpus of videos, when this ticket lands, then a stated path exists for those rows to acquire their durations, with its cost measured rather than assumed and its evidence attached to this ticket.

## Boundaries

- No other metadata field changes how it is stored or served; nothing under `lib/` changes — the AppSync resolvers for `Photo` are passthrough on a Lambda datasource and photo rows arrive through `SELECT *`, so the new column reaches the API without touching them.
- A duration is never inferred. Unknown means absent: no key in the record, no tag in the head, no property in the structured data. Never `0`, which would read as "this video is instantaneous".
- The edge does not parse containers on crawler requests. It uses the number in the record; only when a record has none does it make one cheap metadata read (the pre-existing legacy path) and nothing more.
- The enrichment record's key and versioning contract stays byte-exact for every party that reads it; `duration` is additive, so readers written before this change ignore it.
- The mobile app is not changed: it has never reported a length, and this ticket does not ask it to start guessing one.

## References

- parent — `_bmad-output/seo-indexing/tickets/tickets.toml`
- plan — `_bmad-output/seo-indexing/tickets/story-real-video-duration-plan.md`
- evidence — `_bmad-output/seo-indexing/evidence/duration-metadata-2026-11-11.txt` (no stored object carries duration metadata), `duration-container-probe-2026-11-11.txt` (what reading a real container costs and how many answer), `video-keys-2026-11-11.txt` (the corpus the sample is drawn from)
- tools — `_bmad-output/seo-indexing/evidence/probe-duration-metadata.js`, `probe-container-duration.js`; operator backfill `scripts/populate-video-durations.js` (`npm run populate-video-durations -- prod`, `:dry-run` variant)
- tests — `tests/video-duration.js` (container parser, rules, record shape, write path), `tests/inject-meta-tags.js` ("video length on the first byte"), `WiSaw.client/src/utils/mediaSeo.test.js`, `WiSaw.client/src/videoDuration.contract.test.js` (pins the app's copy of the rules to the backend module and to the tag the edge really emits)
- decision — `_bmad-output/seo-indexing/.memlog.md`, 2026-11-11 duration entry

## Notes

- Risk medium: it adds a column to a table that already holds rows and a field to the API, so a bad migration could break metadata reads for existing media. Nothing is deleted, the column is nullable, and no reader depends on it.
- Waits on seo-indexing/4 because: until the served head survives the render, an app-side tag is either decorative or a second opinion; with 4 built, cold and hydrated can be required to agree.
- Decision 2026-11-11 (Agent, for User review): the ticket as incepted assumed the duration was available at write time as upload-time object metadata. It is not: `probe-duration-metadata.js` sampled 106 of the 842 active video objects in `wisaw-img-prod` and **all 106 carry no user metadata at all**, which is why the edge's metadata read has always returned nothing. The real number exists only inside the container (`moov` → `mvhd`), so it is parsed there — head window for fast-start files, tail window for recordings that write `moov` last (the iPhone layout).
- Decision 2026-11-11 (Agent, for User review): a container is read where a record is about to be written, and the answer is persisted. The comment path learns its own row; the sitemap pass learns a bounded slice of feed videos that still have none (150 per run, concurrency 8). Learning writes only `"duration"` — deliberately not `"updatedAt"`, because bumping it would push every probed video back into the sidecar refresh window on each run — so those rows are published as `urgent` candidates rather than waiting for a touch that will not come.
- Measured cost, not assumed (criterion 5): 40 sampled production videos, **40/40 answered**, median 5 s and longest 18 s; per video ≈665 KB read over 3 ranged GETs plus 1 HEAD, ≈450–490 ms. The whole 842-video corpus is therefore ≈560 MB and ~3.7k requests — one `npm run populate-video-durations -- prod` pass, minutes rather than days. The scheduled slice alone covers it in ~3 runs; the bound exists so a first pass cannot decide whether a sitemap gets published.
- Deployment order matters: run `npm run migrate -- prod` (adds `"duration"`) **before** `npm run prod:deploy`. The reverse fails every write path that touches duration, because the learner's UPDATE names a column that is not there yet. Undoing the ticket is `npm run migrate-undo -- prod`, which drops the column; readers degrade to "no duration stated", which is the pre-ticket behaviour.
- Assumption confirmed while planning: no mobile app change and no client-side estimation — see Boundaries.
- [x] 1. Confirmed where a real duration exists at write time and what happens to older rows — nowhere in our control at upload (no metadata, no app-reported length), so it is read from stored bytes; older rows keep `duration` NULL and simply state nothing until learned (criterion 4, tested byte-identical).
- [x] 2. Added the field through storage, API and app in that order — migration `migrations/20261111000000-add-photo-duration.js`; container parser `lambda-fns/utilities/videoDuration.js` (+ `.d.ts`) with the write-time learner `lambda-fns/controllers/photos/_learnVideoDurations.ts` wired into `_updateSeoSidecar.ts` and `generateSiteMap/index.ts`; API through `graphql/schema.graphql` (`Photo.duration: Int`) and `lambda-fns/models/photo.ts`; app through `src/utils/mediaSeo.js` and the three detail-page selections in `src/containers/PhotosComponent.js`. Each layer landed with its own tests.
- [x] 3. Pointed every consumer at the real value — edge head (`og:video:duration`, JSON-LD `duration`), sitemap `video:duration`, and the hydrated app head/graph, all from the same stored number; the only remaining metadata read is the documented legacy fallback for a record that has no duration.

- Follow-up worth raising (not done here): the player itself still advertises nothing about length to a person (`<video>` shows the browser's own reading of the file, which is fine), and no surface sorts or filters by duration. Neither is required by any criterion above.
