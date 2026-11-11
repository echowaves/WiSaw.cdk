---
workflow: bmad-build
step: 5
ticket: '4'
type: 'bugfix'
title: Edge-injected head tags are rewritten or duplicated by the SPA
status: built
risk: high # raised from the ticket's medium: this edits the byte-exact HTML injection area whose mismatch once deindexed ~22k pages and whose duplicate mount-point literal once blanked every /photos/* page, and a wrong choice here changes crawler signals for ~22k URLs
baseline_revision: a71e9fd5f9d5009164eb5b093b6d325feb79fc63 # WiSaw.cdk; the client half sits on WiSaw.client ee48a089a9c9ebcf4bb1e2af67fe5fe62c61c3b2
review: quick
review_source: pinned
lenses_ran: [quick]
updated: 2026-11-10
---

# Plan: Edge-injected head tags are rewritten or duplicated by the SPA

## Intent

One tag, one owner, same values whether or not JavaScript ran. The edge answers first paint; the app owns the head from then on. Today three of those agreements are broken: different values for the same property (`og:image`, `og:type`, `og:title`, `twitter:card`), tags that survive as permanent duplicates because they lack `data-rh`, and facts the app invents (duration, release date).

## Actions

1. `lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js`
   - `stripExistingMetaTags`: also strip `og:site_name` and `robots`. Patterns must tolerate both quote styles and a self-closing slash — the canonical rewrite failed silently once because it matched only one byte-exact spelling.
   - Media head: point `og:image` and `twitter:image` at `https://img.wisaw.com/<id>-thumb.webp` (the app and the sitemap already publish that path); set `og:site_name` to `WiSaw` — matching the template and the app instead of today's third value `wisaw.com` — and give it `data-rh="true"` so Helmet reconciles rather than duplicates it.
2. `lambda-fns/lambdas/injectMetaTagsLambdaFunction/photo.js`: `og:type` → `photo`. `video.js`: `og:type` → `video.other` (the pair the app already uses).
3. Client `index.html`: add `data-rh="true"` to `og:site_name` and `robots`. Leave `og:locale` alone — nothing else writes it, so it can never duplicate. Touch nothing around the mount point; `src/seo.template.test.js` pins that there is exactly one mention of it.
4. Client `src/utils/mediaSeo.js` (new, pure): map a photo object to its head values — title without the id appended, path segment, image URL from `thumbUrl`, `og:type`, card type, and the structured-data graph. The JSX consumes it; this is what makes AC1/AC3/AC7 testable without mounting Apollo, router, and GA.
5. Client `src/utils/seoDefaults.js` (new): `SITE_NAME`, `ROBOTS_INDEX`, `ROBOTS_NOINDEX` so the per-route declarations are one string each instead of five copies.
6. Client `src/containers/PhotosComponent.js`: drive the `<Helmet>` block from `mediaSeo.js`; drop the appended id, the fabricated `video:duration=30`, `video:release_date=new Date()`, the `max-video-preview:30` robots tag, and the invented `PT0M30S` in the JSON-LD; drop the `player` card and its three companions so videos use the same `summary_large_image` as photos; align the head graph's `@type` with the edge's (`Photograph` for photos, `VideoObject` for videos).
7. Client `Home.js`, `SearchComponent.js`, `About.js`, `Contact.js`, `Terms.js`: declare `robots` and `og:site_name` from `seoDefaults.js`. Required, not cosmetic: a template tag that gains `data-rh` is removed on first client render unless the mounted route declares it, so skipping a route would silently drop its robots directives.
8. Tests: extend `tests/inject-meta-tags.js` for the thumbnail `og:image`, the `og:type` pair, single reconciled `og:site_name`, and the new strip patterns; add `src/utils/mediaSeo.test.js` on the client for title/type/card/image/robots output per media kind.

## Validation policy

- Backend suites run file-by-file with mocha; a clean exit code is proof of behavior. There is no
  `tests/unit/` directory - the suites live directly in `tests/`.
  - `npx mocha --exit tests/inject-meta-tags.js` — baseline 39 passing, now 59.
  - `npx mocha --exit tests/seo-crawler-contract.js` — baseline 34 passing (the `/search*` header contract must not move), now 35.
  - `npm test` — 245 passing with 5 pre-existing failures in `tests/getSeasonBoundaries.test.ts`
    (timezone-dependent, present on the baseline revision; untouched by this change).
- Client: `npx vitest run` (114 -> 126 tests), `npx eslint src --ext .js` (17 problems, all in
  `src/setupTests.js` indentation debt and unused `React` imports that predate this change), and
  `npm run build` — the postbuild hook re-runs `src/seo.template.test.js`, so a broken head
  contract cannot ship silently.
- Adversarial review is required by every gate; no skip.

## Acceptance criteria

- [x] A photo page and a video page each expose exactly one tag per SEO property after hydration. (`src/headHydration.contract.test.js` counts one node per property over both the shipped and the edge-served head, on `/photos/:id` and `/videos/:id`.)
- [x] Exactly one `robots` directive on a media page, and one on a search result page, agreeing with what the edge sends. (Every route declares it; `tests/inject-meta-tags.js` compares the full directive list against `X-Robots-Tag`.)
- [ ] `og:image`, `og:type`, `og:title`, `twitter:card` carry identical values pre- and post-JavaScript for the same URL.
  Partially met, deliberately: `og:image`, `og:type` and `twitter:card` now agree byte-for-byte on a media page, but the title and description *text* is still composed twice (client from recognition labels, edge from `seoText.js`). That text is ticket 6's single source; widening ticket 4 to cover it was rejected at CHECKPOINT 1 in favour of landing the structural fix first. Deferred with evidence in `../deferred-work.md`.
- [x] Media pages publish the thumbnail as `og:image`. (`thumbUrl()` on both surfaces; asserted in `tests/inject-meta-tags.js`.)
- [x] Both sides use one `og:type` pair, photos distinct from videos. (`photo` / `video.other`, pinned on both sides.)
- [x] Structured data describes one entity with one shape on a media page; it is not doubled and not contradictory. (One `Photograph`/`VideoObject` plus one breadcrumb in the head; the edge's body copy inside `#root` is hydration garbage, and the shapes now match.)
- [x] The fabricated release date and the invented video duration are gone, replaced by real values or removed. (Removed: `video:duration=30`, `release_date=new Date()`, `PT0M30S`, `max-video-preview:30`, `copyrightYear`. Real values arrive with ticket 8.)
- [ ] A search result page's `noindex` and the page's other tags agree, and the exclusion stays in place.
  Partially met: the app now declares the same `noindex, follow` the edge sends as both header and meta, plus its own `og:type`; the canonical still diverges because `static.js` collapses `/search/*` onto one route. Owned by ticket 7, recorded in `../deferred-work.md`.
- [ ] No change needed: if the evidence shows the app already reconciles cleanly with no duplication, that is recorded with proof instead of code.

## Boundaries

- Do not touch: anything under `lib/`; `lambda-fns/lambdas/injectMetaTagsLambdaFunction/media.js`'s S3 probe and its duration read; `generateSiteMap/index.ts` (ticket 5); the SEO text rules in `seoText.js`, `utilities/seoSidecar.ts` and the client mirror (ticket 6); the mount-point literal in `index.html`.
- May change: `stripExistingMetaTags`, the media tag block, `photo.js` / `video.js` `og:type`, the template's two attributes, the app's `<Helmet>` blocks.
- Revisit if: aligning structured data turns out to need a schema change — then AC6 moves to ticket 6 rather than expanding this one.

## Assets

- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js` — strip list, media head block, `og:site_name`.
- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/photo.js`, `video.js` — `og:type`.
- `index.html` (client root) — `data-rh` on two tags.
- `src/utils/mediaSeo.js`, `src/utils/seoDefaults.js` (new), `src/containers/PhotosComponent.js`, `Home.js`, `SearchComponent.js`, `About.js`, `Contact.js`, `Terms.js`.
- `tests/inject-meta-tags.js`, `src/utils/mediaSeo.test.js`, `src/headHydration.contract.test.js`.

Estimated scope: ~120 lines including tests, 8 production files across two repos — over the one-shot threshold, so this runs through the full workflow.

## Verification checklist

- [x] Every action numbered above maps to one or more acceptance criteria; no criterion is unowned and no action is unowned.
- [x] Boundaries match the ticket's, including the deferred tickets.
- [x] Validation commands are recorded with their baselines (corrected during triage: there is no `tests/unit/`).
- [ ] Risk level is set, with the reason it was raised recorded in frontmatter.
- [ ] Open questions below resolved by the user at CHECKPOINT 1 before any code is written.

## Open Questions

Resolved by the user at CHECKPOINT 1 on 2026-11-10.

1. **`robots` ownership** → *the app declares robots on every route.* A template tag that gains `data-rh` is removed on first client render unless the mounted route declares it, so all five static routes plus the media page carry the directive from `seoDefaults.js`. Rejected: header-only exclusion for `/search*`, which would leave a head saying `index, follow` under a `noindex` header.
2. **`twitter:card` for videos** → *one `summary_large_image` everywhere.* The app's `player` card and its three companions are dropped rather than the edge learning to emit them.
3. **Which JSON-LD survives** → *the app aligns its head graph to the edge shape* (`Photograph` / `VideoObject`). Both sides keep emitting; a non-rendering crawler and a rendering one now see the same entity type.
4. **Real duration** → *remove the fabricated values now and open a follow-up ticket* to expose real duration through the model and API. This ticket does not grow into an API change.

## Review Triage Log

Lens: `quick` (pinned source), run against the combined two-repo diff at baseline `a71e9fd` /
`ee48a08`. Verdict vocabulary: `high|medium|low` confirmed and severity, `false` disproved,
`maybe-false` unresolved but not blocking. Route: *patched* (fixed in this change), *deferred*
(appended to `../deferred-work.md` or owned by an existing ticket), *rejected*.

| # | Finding (file:lines) | Verdict | Route and evidence |
|---|---|---|---|
| 1 | AC3 unmet on media titles/descriptions: app builds `(photo) <labels>` while the edge publishes `pageTitle` (`seoText.js:104`) | high | Deferred to ticket 6 (`story-seo-text-single-source.md`), which owns one text source. This change aligned structure and the values it could own; presenting AC3 as a scope decision at step 5 rather than silently widening scope. |
| 2 | Edge `og:image:title` / `og:image:caption` destroyed on hydration (never declared in `src/`) | high | Patched: `mediaSeo.imageText()` produces both, `PhotosComponent` declares them, caption dropped when it echoes the title. Pinned by `headHydration.contract.test.js` (`count(...) === 1` over the edge-served seed). |
| 3 | AC3 unmet on static routes (edge `static.js` copy vs each container's marketing strings) | medium | Deferred: ticket 7 (`story-static-route-copy-once.md`) owns static-route copy. This change aligned `og:site_name`, `robots`, and `og:type` there. |
| 4 | Static routes have no `og:image`/twitter tags pre-JavaScript; client adds them after mount | medium | Deferred with ticket 7 (same owner: what a static route publishes). Noted for the deploy note because it is an absent→present change, not a value conflict. |
| 5 | `/search/<term>` gets canonical `https://wisaw.com/search` from the edge and `/search/<term>` from `SearchComponent` | high | Deferred to ticket 7: fixing it means deciding whether `static.js` keeps collapsing `/search/*` to one route (an edge routing change outside this ticket's Boundaries). Recorded with evidence in `../deferred-work.md`. |
| 6 | `/search` loses `og:type` after hydration; `NoMatch` declared `robots` but not `og:site_name` | high | Patched: `SearchComponent` now declares `og:type=website`, `NoMatch` takes site name and robots from `seoDefaults`. This is the removal mechanism this ticket relies on, so leaving it would have traded one bug for another. |
| 7 | `pageUrl`/`pathSegment` derive the URL from the record, not the route; `/photos/<videoId>` and `/videos/<id>` canonicalise to each other | high | Patched: `mediaHead(photo, { pathname })` with `segmentFromPath`, fed from `location.pathname`; test replaced (`takes the canonical path from the route that was asked for`). |
| 8 | `models/photo.ts:27` hardcodes `<id>.mov` while `video.js:57` resolves the real key, so `og:video:*`/`contentUrl` can disagree and 403 | high | Deferred: pre-existing backend model defect, fix belongs in `WiSaw.cdk`'s resolver, not in head-tag ownership. Evidence recorded in `../deferred-work.md`. |
| 9 | Residual fabrication: `copyrightYear: new Date().getFullYear()` and video `created` falling back to S3 `LastModified` | medium | Partly patched: the invented `copyrightYear` is gone from `buildSeoBody`. The `LastModified` vs `photo.createdAt` divergence for `uploadDate` is deferred with ticket 8 (`story-real-video-duration.md`), which owns real media metadata reaching both surfaces. |
| 10 | Plan cites `tests/unit/…` paths that do not exist, so the recorded commands cannot have been run | high | Patched: Validation policy corrected to `tests/inject-meta-tags.js` / `tests/seo-crawler-contract.js` with their real baselines. The commands were actually run from the correct paths; only the plan text was wrong. |
| 11 | `src/mediaSeo.test.js:89` uses Chai syntax (`expect(...).to.have.lengthOf`) in a Vitest suite, so the suite throws | false | Disproved by running it: `npx vitest run src/utils/mediaSeo.test.js` → 13 passed. The line is `expect(items.itemListElement).toHaveLength(2)`; the file has since moved from `src/` to `src/utils/`. |
| 12 | `headHydration.contract.test.js` measures the shipped template instead of an edge-served document, omits production markup (`name='image' property='og:image'`, combined description tag, `og:video:*`) and never exercises a video page | high | Patched by rewriting the suite: it now seeds the real template head, an edge-served variant produced by mirroring `stripExistingMetaTags` + the injection block, mounts the **real** `PhotosComponent` (so all shipped markup is in play), waits for Helmet's deferred pass, covers `/videos/:id`, and asserts `count(selector) === 1` per property. |
| 13 | New header/head agreement assertion compares only the first directive | medium | Patched: the assertion now compares the full comma-separated directive list between `X-Robots-Tag` and `meta[name=robots]`. |
| 14 | Cross-repo constants mirrored by hand with nothing checking them | medium | Patched: `headHydration.contract.test.js > agrees with the edge injector` reads `WiSaw.cdk/.../utils.js` and asserts the shared strings, skipped when the sibling checkout is absent. |
| 15 | Rollout ordering: an already-deployed bundle that declares no `robots` deletes the newly marked tag on hydration | medium | Accepted with mitigation, not code: the change makes every route declare `robots`, so this only bites in a window where the edge is newer than the client. Deploys are manual and ordered; the step-5 presentation states the order (client first, then edge) and notes `X-Robots-Tag` still carries the decision during any window. |
| 16 | A transient AppSync failure renders `NoMatch`, whose Helmet sets `noindex, follow` on a URL the edge served as indexable | medium | Deferred: pre-existing (`NoMatch` predates this change) and fixing it means deciding what a failed fetch should publish. Recorded with evidence in `../deferred-work.md`. |
| 17 | `mediaHead` renders `content=""` for missing values instead of omitting the tag | medium | Patched: `|| undefined` on every optional field plus a filter in the hydration fixture; test asserts `imageUrl` is undefined for an empty record. |

Deferred rows 1, 3, 4, 5, 8, 9 (part), 16 are appended to `../deferred-work.md` with this plan as
their source. No finding's only remedy was an edit to this plan, so nothing was rejected on that
ground.
