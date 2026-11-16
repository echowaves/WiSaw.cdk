---
title: 'Edge-painted static skeleton for photo/video detail pages'
type: 'feature'
ticket: ''
created: '2026-11-15'
status: 'built'
baseline_revision: '2f8ae04fbb8325ebcfb4d46c5ef277767b9cdfe0'
route: 'oneshot'
route_source: 'pinned'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Mobile PSI on detail deep links is bad (video LCP 19.8 s / CLS 0.351, photo LCP ~5 s) because the edge paints a full-resolution `poster` and a bare h1+media block that React throws away at hydration. The client is already built to *adopt* an edge-painted page (WiSaw.client `031bf26`) instead of replacing it, but the edge does not yet emit anything it can adopt.

**Approach:** In `lambda-fns/lambdas/injectMetaTagsLambdaFunction/`, make `buildSeoBody` emit the full static skeleton (reserved header band, aspect-ratio media box carrying the adoption attributes, unchanged h1/description/labels, reserved below-fold space, two enhancement slots, scoped `<style>`, script-local `onerror`), point a video's `poster` at the thumbnail, and give detail pages a `BreadcrumbList` graph plus the full `og:video:*` block in the head. Backend ships first and stays backward-compatible with the deployed client.

</frozen-after-approval>

## Implementation Notes

Oneshot route: one user-facing goal (an adoptable edge-painted detail page) across two files plus tests, spec fully pinned by `_bmad-output/seo-indexing/backend-solicitation-edge-skeleton.md` (C1, C2; C3 dropped). Contract verified against the built client, not inferred.

**Adoption contract (WiSaw.client `031bf26`, `src/utils/detailSkeleton.js`) — all must hold or the client renders fully client-side:** `[data-wisaw-media]` inside `#root`; its `data-wisaw-id` equals the route UUID lower-case; numeric `width`/`height` attributes; non-empty `src` on `<video>`; BOTH `[data-wisaw-slot="header"]` and `[data-wisaw-slot="below"]` present; and `mediaNode.parentElement !== #root` (the box is where overlays portal, so it needs `position: relative`).

**Human decisions recorded during planning:**
- BreadcrumbList = **2 crumbs** (`{position:1,name:'Home',item:'https://wisaw.com/'}`, `{position:2,name:<page title>,item:<canonical>}`), per spec §3 C2 — the client has no `/photos` listing route, and `validation-seo-head-consistency.md:72` already rejected the old 3-crumb shape as invalid.
- ~~`data-wisaw-route="<photos|videos>"` goes on the **skeleton wrapper inside** `#root`.~~ **Not shipped** (corrected by `plan-edge-skeleton-correctness.md`, 2026-11-15): nothing reads such an attribute in either repo, and the kind is already carried twice over — the route path itself and the head (`og:url`, canonical, `og:type`). `<div id="root">` stays byte-identical; `renderRootBody` and the anchor assertions in `tests/seo-crawler-contract.js` are not touched. The adoption contract is exactly what `tests/edge-detail-skeleton.js` asserts: `data-wisaw-media`, `data-wisaw-id`, numeric `width`/`height`, both `data-wisaw-slot` divs, and a positioned media box.

**Geometry mirrored from the client (single source of truth, do not invent numbers):** header 72 px / 64 px below `max-width: 768px` (`src/containers/Header.css:24,226`); media display box = long side capped at 700 px above 700 px viewport, `calc(100vw - 40px)` below it (`src/utils/detailLayout.js` `DETAIL_MAX_SIDE`/`DETAIL_MOBILE_BREAKPOINT`/`DETAIL_MOBILE_GUTTER`); unknown-dims fallback is a 1:1 box; below-fold reserve 220 px (`COLD_BELOW_MEDIA_RESERVE`) as `min-height` so React content can grow.

**During implementation:**
- Files: new `lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js` (style block, slots, media box, breadcrumb graph) and `tests/edge-detail-skeleton.js`; changed `utils.js` (`mediaElement`, `videoMetaTags`, `buildSeoBody` delegation) and one literal in `tests/inject-meta-tags.js`.
- Escaping stays in `utils.js`: `skeleton.js` only ever receives already-escaped markup plus numeric geometry, so there is no second escaper and no utils↔skeleton require cycle.
- `videoMetaTags` was extracted from `injectMetaTags` to keep the cyclomatic-complexity budget (the head function had 7 decision points before this change); that made its `let metaTags` unreassigned, so it is now `const`.
- Slots reserve with `min-height`, not `height`: the header React portals in carries a 1 px bottom border, and a hard `height` would clip it while an exact guess shifts the page.
- `MEDIA_ONERROR` is stored pre-escaped (`&amp;&amp;`) because it is interpolated verbatim into a double-quoted attribute; tests assert it contains no origin, `fetch`, `eval` or `window.`.
- Verified in `tests/edge-detail-skeleton.js`: injecting the skeleton into `tests/fixtures/served-index.html` still leaves exactly one `<div id="root">` literal and one `id="root"` anywhere past the mount point — the client's `seo.template.test.js` counts that string.
- Lint: `npm run lint` fails on main already (`tests/auto-group.js`, `tests/inject-meta-tags.js:129`, `tests/static-route-copy-once.js`, `tests/video-duration-at-upload.js`) — re-checked against the baseline revision to be sure. Touched files are clean via `npx ts-standard --no-cache <files>`; the default cache path `~/.cache/ts-standard` is blocked by the sandbox, hence `--no-cache`.
- Suite: 339 passing / 5 failing, the 5 being the documented `getSeasonBoundaries` timezone set.

**Shape decisions:**
- Two separate `<script type="application/ld+json">` blocks — media graph first (byte-identical rules, existing tests parse the first block), `BreadcrumbList` second. Valid schema.org, keeps `Photograph`/`VideoObject` assertions untouched.
- New module `skeleton.js` in the injector folder holds the skeleton renderers (`utils.js` `buildSeoBody` delegates) so cyclomatic complexity stays ≤ 8. Folder is deployed raw-zip via `Code.fromAsset`, so it must live there, CommonJS, no deps.
- Scoped CSS uses unique `wsk-` class names + descendant selectors only (no `>`), stays under 2 KB, and never writes the literal `id="root"` anywhere in the body.
- Photo `<img src>` stays full-resolution (the shell's swap script demotes to thumb); video `poster` becomes `thumbUrl(imageId)`, so the full-res `.webp` key survives only in JSON-LD `contentUrl`.

## Review Triage Log

Pass 1 (`quick`, run on the main thread per the operator's standing instruction for this session: single-model endpoint, no subagents or parallel model calls; the lens prompt was executed as written against plan + `AGENTS.md` + the unified diff from `2f8ae04`). Verdicts: 0 high, 1 medium, 0 low kept, 4 false, 1 maybe-false.

- **medium — defer:** `og:video:type` is the literal `video/mp4` while `og:video:url` names whatever object storage holds (`mediaNaming.VIDEO_EXTENSIONS` lists `mov` first and `videoObjectKey()` falls back to `<id>.mov`), so an iPhone upload announces the wrong MIME type. Real, but the spec pins that constant as the cross-repo contract value; recorded in `_bmad-output/seo-indexing/deferred-work.md` rather than changed unilaterally.
- **false:** "the cleaner can leave a template's `og:video:*` next to the injected copy." Checked both shells this runs against — `tests/fixtures/served-index.html` and WiSaw.client `index.html` / `build/index.html` carry no `og:video` tag, and injection happens once per response, so there is nothing to double.
- **false:** "the box's inline `style` is written without escaping." `mediaBoxStyle()` builds it only from `positiveInt()` results, so no record text can reach the attribute.
- **false:** "the frame omits `.content-container`'s card background/border." Intentional: theme custom properties are unknown at the edge and a wrong-color flash is worse than none; padding and max-width match the app's rule exactly, so adoption shifts nothing.
- **false:** "the frame should use `<main>`." The pre-skeleton body had no landmark either, and after adoption React's own wrapper lands in `#wisaw-app`, so a second landmark would be wrong rather than better.
- **rejected (pre-existing):** counting every `||` fallback as a decision point puts `buildSeoBody` over the project's complexity ceiling — that structure predates this change, and this change removed three decision points from it (`if/else` media branch + two dims ternaries) while adding none; the new functions sit at 1–4.

## Verification

**Commands:**
- `npx mocha --exit --require @babel/register tests/inject-meta-tags.js` -- expected: pass, including new skeleton/poster/breadcrumb/OG-video assertions.
- `npx mocha --exit --require @babel/register tests/seo-crawler-contract.js` -- expected: pass with its `<div id="root">` and script-count assertions unmodified.
- `npx mocha --exit --require @babel/register tests/static-route-copy-once.js` -- expected: pass (static copy untouched).
- `npm test` -- expected: green except the 5 known pre-existing `getSeasonBoundaries` timezone failures on main; any other failure is a regression.
- `npm run lint` -- expected: no ts-standard errors.

**Deliberate assertion changes:** `tests/inject-meta-tags.js` "replaces only the mount point contents in the served shell" asserts the crawler body adds exactly one `<script>`; the second JSON-LD graph makes it two. Reason: BreadcrumbList is a required new graph and spec §3 keeps the media graph's rules unchanged, so it must be its own block. The assertion still proves no shell script was lost — only the added-count literal changes from +1 to +2.

**Manual check:** print `buildSeoBody` output for a photo and a video record and diff the SERP-visible strings (h1 text, description `<p>`, label links, nav) against the same call at baseline — they must be byte-identical; only structure/media/JSON-LD may differ.
