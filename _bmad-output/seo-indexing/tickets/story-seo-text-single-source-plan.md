---
type: 'feature'
ticket: '6'
status: 'in progress'
created: 2026-11-10
updated: 2026-11-10
spec: ../spec.md
---

# SEO text is produced once, in the record that both surfaces read

Plan for ticket `6` (`story-seo-text-single-source`). High risk per the ticket — it touches the
sidecar contract and every consumer of it, so the build order is backend-first with a compatibility
window on every step.

## Intent

`seoText.js` exists twice (edge reader, SPA) plus a third mirrored copy of the same rules in the
writer (`utilities/seoSidecar.ts`) and a fourth in `scripts/publish-seo-sidecars.js`. The record is
supposed to be the single source, but it stores raw parts and each surface re-derives text with its
own word budgets and month formatting, which is why first byte and hydrated head disagree today.
The writer puts finished strings in the record; everyone else renders them.

## Decisions

> **Agent decision (2026-11-10).** The four HITL questions were put to the user, who was unavailable;
> these are the pragmatic options, recorded for review. Reverting any of them is a small change:
> 1. **Where the app's per-media text comes from: fetch `<id>.json`.** It already carries the place
>    and labels, it is public by design (the edge reads it), and it needs no schema/API change — the
>    ticket explicitly rejects inventing fields. The alternative (new API columns) stays open as a
>    follow-up if the extra request ever matters; it does not compete with media loading.
> 2. **When no record exists yet: re-declare what the first byte served.** The injector already
>    computes a correct title/description from the entity label for exactly this case, so the SPA
>    changes nothing on such a page — zero drift by construction, and it is the only option that
>    cannot invent text the crawler never saw.
> 3. **Sidecar version: additive `v:1`.** Add a nested `seo` object with finished strings; keep every
>    existing field and its meaning. Old edge code ignores the new key, new edge code falls back to
>    deriving when it is absent, so no deploy order is forced and no fleet-wide regen is needed.
> 4. **Records written before this change: derive at the edge (fallback), no bulk rewrite.** The
>    operator script (`scripts/publish-seo-sidecars.js`) can refresh them whenever convenient; the
>    fallback keeps correctness meanwhile, and the derived path is now the SAME module the writer
>    uses, so old and new records render identically anyway.

## Findings that shape the plan

- Four copies of the rules exist: `injectMetaTagsLambdaFunction/seoText.js` (reader),
  `utilities/seoSidecar.ts` (writer; its comments say outright "mirrors … because it cannot import
  it"), `scripts/publish-seo-sidecars.js` (operator backfill, third mirror), and the client's
  `src/utils/seoText.js` (deleted by this ticket).
- Two different word budgets are in use for the same slot: page title 68 chars at the edge vs image
  `<image:title>` 100 chars in the writer. That is legitimate (different slots) — the fix is one
  module that names both budgets, not one number.
- Both sides already share the same word-boundary truncation *algorithm* and the same UTC month
  rule; only their constants and code paths differ. One `truncateWords` + `monthYear` kills AC1.
- Shipping mechanism is settled by ticket 5: shared plain JS inside the injector folder with a
  `.d.ts` beside it (`Code.fromAsset` zips that folder verbatim; esbuild lambdas import across).

## Actions

1. **New shared module `injectMetaTagsLambdaFunction/seoRules.js`** (+ `.d.ts`) — plain CJS, zero
   deps: budgets (`TITLE_MAX`, `HEAD_MIN`, `DESC_MAX`, `IMAGE_TITLE_MAX`, `IMAGE_CAPTION_MAX`,
   `TAG_TITLE_LIMIT`, `LABEL_LIMIT`), `clean`, `truncateWords`, `monthYear`, `normaliseLabels`,
   `pickLabels`, `locationText`, `isPreciseLocation`, `PRECISE_KEYS`, `splitImageText`, and the new
   `buildSeoStrings({ id, kind, caption, labels, location, created })` returning the finished page
   pair `{ title, description }` with exactly today's edge composition rules.
2. **Writer** (`utilities/seoSidecar.ts`): delete its mirror copies, import from the module, and add
   `seo: { title, description, imageTitle, imageCaption }` to the record — strings computed by the
   same functions the sitemap already uses for its slots. `assertNoPreciseLocation` keeps throwing,
   now against the shared `PRECISE_KEYS`.
3. **Edge reader** (`seoText.js`): becomes a thin renderer — `sidecar.seo.*` verbatim when present;
   otherwise derive through the SAME module (decision 4). No local budgets or regexes left.
4. **Sitemap generator + operator script**: consume the module instead of their own copies, so the
   backfill produces byte-identical records to the scheduled job.
5. **Client**: `src/utils/seoRecord.js` fetches `https://img.wisaw.com/<id>.json` once per id with a
   Map cache and shape validation; `mediaSeo.buildMediaHead(photo, { seoRecord })` takes title and
   description from the record when present, else re-declares the served head (decision 2); delete
   `src/utils/seoText.js`; prefetch neighbour records inside the existing media preload.
6. **Tests**: a cross-consumer test that writer strings == edge-rendered strings == sitemap slot
   strings for identical inputs; word-not-byte truncation through both entry points; contract test
   updated for the additive key; client tests for record path, fallback path, and "composes nothing".

## AC mapping

- **AC1** (one module): Actions 1–4; the cross-consumer test is the acceptance evidence.
- **AC2** (byte-identical title/meta/og:title): stored `seo.title` renders into `<title>`,
  `meta[name=description]` and `og:title` on both surfaces; contract + client tests assert equality.
- **AC3** (record holds finished strings, edge does no text work): Actions 2–3.
- **AC4** (extension and duration stay live-resolved): untouched — ticket 5's module for the
  extension, object metadata for duration until ticket 8.
- **AC5** (SPA fetches or re-declares; `seoText.js` gone): Action 5.
- **AC6** (no fabricated duration): already true since ticket 4; no change here.

## Validation policy

Backend: new test file + `tests/seo-crawler-contract.js`, `tests/inject-meta-tags.js`,
`tests/sitemap-image-text.js`; full suite once, lint delta vs baseline on every touched path.
Client: `mediaSeo`/head-hydration suites + a new record test; eslint delta; build + postbuild.
