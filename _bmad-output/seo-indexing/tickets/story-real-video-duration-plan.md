---
type: 'feature'
ticket: '8'
status: in review
step: 4
created: 2026-11-11
updated: 2026-11-11
spec: ../spec.md
risk: medium
baseline_revision: 63ad7fa
lenses_ran: []
---

# Real video duration: learned at write time, served everywhere, never invented

Plan for ticket `8` (`story-real-video-duration`). Medium risk (from the ticket tree): a new DB
column, a container parser that reads production video bytes, and one SEO contract shared by three
surfaces. Backend-first (storage → API), then the app formats from the same rules.

## Intent

**Problem:** Every video page advertises a duration of zero or none at all. The edge reads
`Metadata.duration` from S3, but a live probe of 106 production `.mov` objects found *no user
metadata on any of them* (`evidence/probe-duration-metadata.js`, 2026-11-11), so `readDuration()`
always returns `''`; the sidecar record has no duration field at all, and the app deliberately
invents none. Google's VideoObject rich result wants `duration`, and a video that declares seconds
it doesn't have is exactly the dishonest metadata this spec exists to prevent.

**Approach:** The real number lives in the QuickTime/MP4 container (`moov`→`mvhd`), so the backend
learns it at write time: when a sidecar is about to be written for a video row whose stored duration
is null, read the container header with two ranged GETs, persist seconds on the `Photos` row, and
put the value in the record. Every surface then renders only a stored real value — edge tags, JSON-LD
as ISO 8601, and the app from the API/record — and omits duration entirely when nothing is known.

## Boundaries & Constraints

**Always:**
- Duration is never invented: no heuristics from file size or upload timestamps; unknown ⇒ the field
  is absent (record key omitted), tags unrendered, JSON-LD property missing.
- One parser, one formatter: `lambda-fns/utilities/videoDuration.js` learns; `seoRules.js` owns
  `durationSeconds()`/`iso8601Duration()` normalization used by edge, records and (via contract test)
  the app.
- Ranged reads only, bounded: head window + tail window ≤ ~1 MB per video total; corrupt or oversized
  boxes stop the parse rather than buffering the object.
- The migration follows `.github/instructions/db-migrations.instructions.md` (timestamped kebab
  verb name, `up`/`down`, no transactions, emoji logs); new column is nullable so old rows are valid.
- Existing sidecar records stay byte-identical until a video's duration is actually learned
  (key omitted when unknown).

**Never:**
- No changes to CDK infrastructure code (`lib/`) — AppSync resolvers are passthrough, and the schema
  change alone exposes the field.
- No mobile app API contract changes; no `ObjectFactory` copy loops; no writes to S3 object metadata.
- Do not touch `updatedAt` when learning durations (it would silently widen the sidecar refresh window).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error handling |
|----------|--------------|---------------------------|----------------|
| iPhone-style MOV | `moov` at end of object, mvhd v0 | seconds from timescale/duration via tail window | — |
| Front-`moov` MP4/MOV | `moov` in first bytes | same via head window | — |
| mvhd v1 / 64-bit largesize | version-1 header, `size==1` box | correct seconds (BigInt duration) | — |
| Fragmented MP4 (`moof`, no `mvhd`) | streaming recording | parser stops at EOF scan limit → `null` | logged, row stays null |
| Corrupt/truncated container | box size < 8 or beyond EOF | parse stops → `null` | HeadObject/GET errors → `null` |
| Absurd value | duration > 24 h or ≤ 0 | treated as corrupt → `null` | — |
| Legacy sidecar without duration | record exists, row null | edge falls back to one container probe; tags only if it succeeds | probe failure → omit |

## Code Map

- `migrations/XXXX-add-photo-duration.js` (new) — nullable `"duration"` INTEGER on `"Photos"`.
- `lambda-fns/utilities/videoDuration.js` (+`.d.ts`) — box walker + `readVideoDuration(s3, bucket, key)`; plain JS because the edge imports it directly (precedent: `mediaNaming.js`).
- `lambda-fns/utilities/seoRules.js`/.d.ts — add `durationSeconds()` (accepts seconds, `MM:SS`, ISO 8601 → int|null) and `iso8601Duration()`; `buildSeoFields.duration` normalizes.
- `lambda-fns/utilities/seoSidecar.ts` — `SeoSidecar.duration?`; record includes `duration` only when known.
- `lambda-fns/controllers/photos/_learnVideoDurations.ts` (new) — probe + `UPDATE "Photos" SET "duration"` for rows lacking it; returns learned rows so callers publish their sidecars in the same run.
- `lambda-fns/controllers/photos/_updateSeoSidecar.ts` — learn before building the record (single-row path).
- `lambda-fns/lambdas/generateSiteMap/index.ts` — bounded learning pass over feed videos lacking duration; learned rows join the sidecar publish set regardless of the touch window.
- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/media.js` — keep probe as legacy fallback, normalize via `durationSeconds`.
- `.../video.js`, `.../utils.js` — prefer record duration; emit `og:video:duration` (seconds) and JSON-LD `VideoObject.duration` (ISO 8601); omit both when unknown.
- `graphql/schema.graphql`, `lambda-fns/models/photo.ts` — `Photo.duration: Int`; model passes the column through (`SELECT *` already returns it).
- `scripts/populate-video-durations.js` (new) — operator backfill, pattern of `populate-photo-dimensions.js`.
- `tests/video-duration.js` (new), `tests/seo-crawler-contract.js`, `tests/inject-meta-tags.js` — parser fixtures + contract.
- `WiSaw.client/src/utils/mediaSeo.js`(+test) — duration from record/photo, og tag + ISO JSON-LD, omitted when unknown; cross-repo pin against `iso8601Duration`.
- `WiSaw.client/src/containers/PhotosComponent.js` (+`src/graphql/*`) — select `duration`, render the tag.

## Tasks & Acceptance

**Execution:**
- [ ] `migrations/20261111000000-add-photo-duration.js` — add nullable column + reversible down
- [ ] `lambda-fns/utilities/videoDuration.js` + `.d.ts` + `.gitignore` negation — container parser, unit-tested against synthetic fixtures (v0/v1/64-bit/tail/corrupt)
- [ ] `seoRules.js`/.d.ts — duration normalization helpers; `tests/video-duration.js` edge cases
- [ ] `seoSidecar.ts`, `_learnVideoDurations.ts`, `_updateSeoSidecar.ts`, `generateSiteMap/index.ts` — write-time learning + record field (omitted when unknown)
- [ ] edge `media.js`/`video.js`/`utils.js` — real-or-omit tags and JSON-LD; contract test additions
- [ ] `graphql/schema.graphql`, `models/photo.ts` — serve the value in the media response
- [ ] `scripts/populate-video-durations.js` — backfill tool + measured cost recorded in `evidence/`
- [ ] client: gql selection, `mediaSeo.js` duration block, `PhotosComponent.js` tag; vitest incl. cross-repo formatter pin

**Acceptance Criteria:** see the refined leaf; the plan adds one property test beyond it — a sidecar
for a video whose duration is unknown must be byte-identical to today's output.

## Implementation Notes

- 2026-11-11: Probe evidence written to `evidence/probe-duration-metadata.js` (106/106 objects carry
  no user metadata) and `evidence/video-keys-2026-11-11.txt` (842 `.mov` keys — the backfill corpus).
  RDS is VPC-only (`getaddrinfo ENOTFOUND` from this machine), so sizing evidence comes from S3.

## Plan Change Log

## Review Triage Log

## Design Notes

Parser shape: `findTopLevelBox(buf, 'moov')` walks box headers (4-byte size + type, `size==1` →
8-byte largesize, `size==0` → to EOF); a tail window of the last 512 KB is scanned for a top-level
`moov` because iPhone recordings write it last; `durationFromMoov` finds `mvhd` inside and converts
`timescale`/`duration` (v0 int32 @12/16, v1 uint64 @20/24) to floored seconds. Golden example:
`timescale 1000, duration 48750 → "PT48S"` (seconds 48). Values > 86 400 s or ≤ 0 are rejected as
corrupt. The same `durationSeconds()` normalizes record strings (`"PT48S"`, `"120"`, `"0:48"`) so a
legacy value can never leak into tags unformatted.

## Verification

**Commands (WiSaw.cdk):**
- `npm test` -- expected: only the five pre-existing `getSeasonBoundaries` timezone failures; new
  duration suites green
- `HOME="$TMPDIR" npx ts-standard lambda-fns/utilities/*.ts lambda-fns/controllers/photos/_learnVideoDurations.ts`
- `node -e "require('./lambda-fns/utilities/videoDuration.js')"` smoke import

**Commands (WiSaw.client):**
- `npx vitest run` -- expected: all green incl. duration block tests and the cross-repo pin
- `npx eslint src/utils/mediaSeo.js src/containers/PhotosComponent.js`; `npm run build`

**Manual checks:**
- `node scripts/populate-video-durations.js --env test --dry-run --limit 3` lists probe results without writing (run against test env if reachable; otherwise record why).
