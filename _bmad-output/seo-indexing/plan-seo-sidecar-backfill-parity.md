---
title: 'SEO sidecar backfill must publish exactly what the live writers publish'
type: 'bugfix'
ticket: ''
created: '2026-11-15'
status: 'built'
baseline_revision: '0d3bd0f82e58d897032dca9a955235ed5ea8ccec'
route: 'oneshot'
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

**Problem:** Three writers publish the public `<id>.json` SEO sidecar. The upload trigger (`processUploadedImage`) and the scheduled publisher (`generateSiteMap`) both read a full `p.*` + labels row and write through `putSeoSidecar()`, so their bodies are byte-identical. The operator backfill `scripts/publish-seo-sidecars.js` selects a hand-written column list that predates ticket 8's `duration` field, so running it rewrites every video sidecar **without** its duration — and nothing self-heals: the scheduled pass only refreshes rows whose `updatedAt` moved (an S3 PUT does not move it), and `learnVideoDurations` only picks rows whose DB `duration` is still null. Verified by running the real rules module over both row shapes: the only difference in the published body is a dropped `"duration"`.

**Approach:** Give the backfill script the same row shape as the live writers (`SELECT p.*, COALESCE(r."labels", …) AS "labels"` from active photos) and make it write through `putSeoSidecar()`/`sidecarKey()` instead of its own literal key and PUT, so neither the record contents nor the object metadata can drift again. Then fix the parity test that failed to catch this: its shared fixture row carries no `video`/`duration`, so deep equality between the two writers passed while the column was missing — it must cover a measured video, and must additionally prove that every field `buildSeoRecord` consumes reaches the script's record from whatever the script selects.

## Boundaries & Constraints

**Always:** Unknown duration stays absent (never `0`); records stay byte-identical for rows that have nothing new; geography (`p."location"`) may be fetched only because no writer reads it — a record's place name is composed from the address columns alone, and `assertNoPreciseLocation` screens what does get composed, so no coordinate may reach a published body. Keep the script's CLI contract (`env` positional, `--dry-run`, `--batch-size=`, `--limit=`, `--concurrency=`) and its `{written, failed}` reporting.

**Never:** No change to `seoRules.js`, `putSeoSidecar()`, the scheduled publisher, the upload trigger or the comment path; no migration; no prod run of the script as part of this work; no new dependencies (only the `ts-node/register/transpile-only` hook `scripts/populate-video-durations.js` already uses).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Measured video | row with `video=true`, `duration=47` | script's record deep-equals `buildSeoSidecar(row)` and carries `"duration":47` | no error expected |
| Unmeasured video | `duration` NULL | both writers omit the key entirely | — |
| Photo | `video=false` | unchanged record, no `duration`, `seo.kind=photo` | — |
| Geography column arrives via `p.*` | `location` value in any of the four known shapes | nobody reads it: the record carries only the place name composed from the address columns | no error expected (verified: no coordinate digits in the body) |
| Coordinate-shaped value in an ADDRESS column | `locality`/`district`/`region` holding e.g. `"40.6833, -73.9740"` | `assertNoPreciseLocation` throws while composing the record, before any PUT | throw propagates into `{ failed }` count, run continues |
| Key shape | uppercase id | object key equals `sidecarKey(id)` (lowercased `<id>.json`, bucket root) | — |

</frozen-after-approval>

## Code Map

- `scripts/publish-seo-sidecars.js` — the defect. `QUERY` (~:103) lists columns; PUT loop (~:150) builds `seo/`-free literal key `` `${String(row.id).toLowerCase()}.json` `` + its own `ContentType`/`CacheControl`; exports `{ buildSidecar, pickLabels, QUERY }` consumed only by `tests/seo-crawler-contract.js`. Its `pickLabels` wrapper exists solely because the query handed bare labels — dead once rows are full.
- `lambda-fns/utilities/seoSidecar.ts` — `putSeoSidecar()` (:84), `sidecarKey()` (:80), `buildSeoSidecar()` (:76). Reuse, do not modify. Needs the ts-node hook to be required from plain JS (see `scripts/populate-video-durations.js:20`).
- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoRules.js` — `buildSeoRecord()` (:319) consumes exactly: `id, video, lastComment, createdAt, width, height, duration, labels, locality, district, region`. Do not modify.
- `tests/seo-crawler-contract.js` — parity cases live in the `describe('<id>.json sidecar …')` block (~:187–243): shared `row` fixture has no `video`/`duration`; "publishes the same bytes" does deep equality; "the backfill query selects the address columns and never the geography column" regex-matches `"locality"`/`"region"` in `QUERY` — that assertion must be rewritten for a `p.*` select while keeping the geometry prohibition.
- `tests/video-duration.js`, `tests/upload-seo-sidecar.js`, `tests/seo-text-single-source.js` — neighbouring suites to keep green; identity pins on `writer.pickLabels` etc. are unaffected.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/publish-seo-sidecars.js` -- add `require('ts-node/register/transpile-only')` before requiring TS; import `{ putSeoSidecar, sidecarKey }`; replace the column list with `SELECT p.*, COALESCE(r."labels", '[]'::jsonb) AS "labels"` keeping the scalar-guard LATERAL join, `active = true`, `ORDER BY "createdAt" DESC` and `--limit`; write via `putSeoSidecar()` (dry-run still prints); drop the now-dead `pickLabels` wrapper; update the header comment to say the row shape is shared with the live writers.
- [ ] `tests/seo-crawler-contract.js` -- extend the sidecar parity block: a measured-video fixture asserted to deep-equal across both writers and to carry `duration`; a guard that strips the full row down to the columns `QUERY` actually selects (a `p.*` select short-circuits as complete) and requires the resulting record to still deep-equal the live writer's; rewrite the geometry assertion so it forbids publishing coordinates without naming address columns in the SQL.

**Acceptance Criteria:**
- Given a video row whose duration is measured, when the backfill builder and `buildSeoSidecar` are handed the same row, then the two records are deep-equal and both state `"duration":47`.
- Given every field `buildSeoRecord` reads, when the contract test derives what the script's `QUERY` provides, then no consumed field is missing.
- Given the script writes an object, when its PUT is intercepted in a test, then key/bucket/`ContentType: application/json`/`CacheControl: max-age=60` come from `putSeoSidecar()`/`sidecarKey()`.
- Given the whole existing suite, when it runs, then no previously passing test changed verdict.

## Implementation Notes

Oneshot because the change is two files and well under 100 lines: one query + one write path in an operator script, plus the test that pins it. No schema, no deployment wiring, no prod execution.

- `scripts/publish-seo-sidecars.js`: `require('ts-node/register/transpile-only')` at the top (same hook `populate-video-durations.js:20` uses) so the TS writer can be required from a script node runs directly; verified it loads both under plain `node` and inside the mocha suite, where `@babel/register` is already active.
- The script now imports `{ putSeoSidecar, sidecarKey }` and PUTs through the live writers' helper; dry-run prints `sidecarKey(row.id)` so what it shows is the key it would write. Its own `pickLabels` wrapper was dead weight once rows are full (it existed only because the old query handed bare labels), so it is gone and the module exports `{ buildSidecar, QUERY }`.
- Test coverage went one step past the plan: besides the parity/field-coverage cases in `tests/seo-crawler-contract.js`, `tests/seo-sidecar-lifecycle.js` now pins `putSeoSidecar` itself (key, bucket, `ContentType`, `CacheControl`, body carries `duration`, S3 failure propagates) — the research document lists "nothing touches putSeoSidecar" as an uncovered path, and this change makes every writer depend on it.
- Guard has teeth, proven: temporarily restoring the old explicit column list makes the suite fail with `AssertionError: query selects "duration": expected [...] to include 'duration'`, then restores clean.
- Suite baseline is not green: `tests/season-key.js` `getSeasonBoundaries` fails 5 cases on this machine (timezone formatting) both before and after this change — 346 passing at baseline, 352 with the six new cases, same 5 failures. Left alone as unrelated pre-existing.
- `npm run lint` needs a writable `$HOME` for ts-standard's flat cache (`~/.cache/ts-standard`); run it as `HOME="$TMPDIR" npm run lint` in a sandbox. The repo carries many pre-existing violations; the three touched files report none.
- Review round: the script's write loop is now `publishChunk(client, bucket, rows, dryRun)`, exported so a test can drive the real PUT with a stubbed client (bucket, key, body, `{written, failed}`, and that a dry run PUTs nothing). Dry run prints `duration=<n|none>` beside the preview because a caption at the record's 200-char limit pushes the field past the cut.
- Two pins added after review: `every writer reads one row shape out of Photos` compares the flattened `SELECT … FROM "Photos" p` clause across the backfill query, `PHOTO_SEO_QUERY` and the sitemap job's inline query — the drift lived in what a writer selected, so that is what gets pinned; and `the backfill query hands over every field the record is built from` now parses `` p."col" `` correctly (its first version required `p.col"`, which matches nothing).
- Both guards re-proven against the reintroduced bug: restoring the old column list fails with `query selects "duration"` and `backfill selects the shared row shape`.

## Plan Change Log

## Review Triage Log

Pass 1 (`quick` lens, 8 findings): high 1 · medium 3 (two grouped by root cause) · low 3 (2 patched, 1 rejected) · false 0.

- **high — the derived-column regex in `tests/seo-crawler-contract.js` required `p.col"`, which no real column list contains**, so a reverted explicit list would have failed on `"id"` rather than naming the field actually missing (and the recorded teeth-check predated the lint fix that broke it). Patched to match `` p."col" ``; re-proven by reintroducing the old select list → `query selects "duration"`. KEEP: derive the columns from `QUERY` instead of listing them in the test.
- **medium — the parity claim was never pinned to the live writers' SQL** (two findings, one root cause): with `p.*` the deep-equality line compares `buildSeoRecord` against itself, and only a comment tied the script's SELECT to `PHOTO_SEO_QUERY` / the sitemap job. Patched with `every writer reads one row shape out of Photos`, which flattens and compares the `SELECT … FROM "Photos" p` clause across all three sources.
- **medium — acceptance criterion 3 was met by a source grep rather than by driving the script**: `main` is not exported, so nothing intercepted its PUT to check the bucket or the row handed over. Patched: `publishChunk(client, bucket, rows, dryRun)` extracted and pinned in `tests/seo-sidecar-lifecycle.js` — bucket it was given, `<id>.json`, body carries `duration`, a rejected write is counted as failed, a dry run PUTs nothing.
- **medium — a dry run could not display the field this change restores**: `duration` sits after a caption of up to 200 characters inside a 200-character preview, so an operator following the plan's manual check would have concluded the fix did nothing. Patched: dry run prints `duration=<n|none>`; pinned with a record whose caption is at the limit.
- **low (patched in code, wording left to the human) — the frozen I/O matrix says the coordinate guard screens the fetched geography column.** It does not: `locationText` composes the place name from `locality`/`district`/`region`, and only that composed value reaches `assertNoPreciseLocation`. The safety outcome is unchanged; this change's own comment was corrected, and a new case proves a coordinate-shaped *address* value stops the write and is counted as failed. The matrix sentence itself sits inside `<frozen-after-approval>` and needs the user's call. RESOLVED 2026-11-15: on the user's explicit instruction the frozen wording was corrected — the matrix now distinguishes the ignored geography column from a coordinate-shaped address value (which does throw into `{ failed }`), matching the two tests that pin each case.
- **low — rejected: `require('ts-node/register/transpile-only')` at module load would break an `--omit=dev` install.** These operator scripts only ever run from a full checkout (they need `.env.<env>`, the RDS CA bundle, `serverless-postgres`) and `scripts/populate-video-durations.js:20` already loads the same hook; guarding that path adds code nobody exercises.

## Verification

**Commands:**
- `npx mocha --exit --require @babel/register tests/seo-crawler-contract.js tests/seo-text-single-source.js tests/video-duration.js tests/upload-seo-sidecar.js tests/seo-sidecar-lifecycle.js --timeout 30000` -- expected: 0 failing, including the new duration-parity and column-coverage cases.
- `npm test` -- expected: full suite passes with no new failures against the baseline.
- `HOME="$TMPDIR" npm run lint` -- expected: no violations reported for the three touched files (the repo carries many pre-existing ones elsewhere; `$HOME` is only needed where the cache directory is read-only).

**Manual checks (if no CLI):**
- `node ./scripts/publish-seo-sidecars.js prod --dry-run --limit=3` prints `<id>.json duration=<seconds>` for a video — operator-run with credentials, not part of this build.
