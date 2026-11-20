---
title: 'Edge-painted detail page column is a main landmark'
type: 'bugfix'
ticket: ''
created: '2026-11-20'
status: 'built'
baseline_revision: 'da93a68936dac9c9bb56e5be3875dbc6a685ff9b'
route: 'oneshot'
route_source: 'pinned'
risk: 'high'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A detail page Lambda@Edge paints has no `main` landmark, so axe/Lighthouse `landmark-one-main` fails on every `/photos/*` and `/videos/*` URL — the routes carrying essentially all site traffic. The client half of this rule shipped 2026-11-20 (`WiSaw.client@7ad8182`) and covers `/`, `/search`, `/about`, `/contact`, `/terms` and the no-record state, but a settled detail page's whole column comes from `renderSkeleton`, which opens it with `<div class="wsk-main">`; React adopts those nodes precisely so it never re-renders them, so no client change can fix it.

**Approach:** In `lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js`, rename that one tag to `<main class="wsk-main">` … `</main>` (C6) and add a third enhancement slot outside the column — `slot('footer')` between `</main>` and the wrapper's closing div, with one `SKELETON_STYLE` rule `.wsk-slot-footer{max-width:1100px;margin:0 auto;padding:0 20px}` (C6b), because a `<footer>` portalled under `<main>` is generic rather than contentinfo and `below` is inside the column. Then move the things that pin those bytes: re-cut `tests/fixtures/edge-detail-bodies.json` from the renderer, extend the landmark pin in `tests/edge-detail-skeleton.js`, and run `node scripts/publish-detail-template.js` so the committed copy in `WiSaw.client/src/utils/detailTemplate.generated.js` matches.

**Renegotiated 2026-11-20 mid-run:** the operator added C6b (brief §10, revised paste-ready prompt) — the footer slot plus that one CSS rule are now in scope, superseding "no other byte of markup or style changed". Adoption stays header+below only: a frame served by an older edge with no footer slot must remain adoptable.

</frozen-after-approval>

## Implementation Notes

Oneshot route: one user-facing goal (a landmark on the served detail page) expressed as one tag rename plus the fixture, pin and published-copy moves it implies; the spec is fully pinned by `WiSaw.client/_bmad-output/initiative-mobile-core-web-vitals/backend-solicitation-brief.md` §10 (C6). File list: `lambda-fns/lambdas/injectMetaTagsLambdaFunction/skeleton.js`, `tests/fixtures/edge-detail-bodies.json` (regenerated), `tests/edge-detail-skeleton.js`, and — outside this repo, the only permitted write there — `WiSaw.client/src/utils/detailTemplate.generated.js`.

**Verified against the code before writing anything:**
- `renderSkeleton` (`skeleton.js:150-163`) is the only writer of `wsk-main`; the class rule in `SKELETON_STYLE` (`skeleton.js:54`) is class-based, so it stays byte-identical. No comment in that file calls the column a div, so no wording needs fixing.
- The mount-point contract is structural over `<div>` only: `findRootCloseStart` (`utils.js:241-254`) counts `</?div\b`, and `BOOT_CRITICAL_PATTERNS` (`utils.js:121-127`) matches module scripts, stylesheets, `<script`, `#root` and `#wisaw-app`. A `<main>` neither adds a `</div>` nor moves any of those counts.
- Brief's two recorded non-issues both hold: `static.js` exports only `headFor`/`routeFor` (no body path; `bodyHtml` defaults to `''`, so `renderRootBody` returns the shell untouched), and `utils.js:98` already wraps the no-record document in `<main>`.
- The fixture has no provenance block *inside* it. Provenance lives in `tests/detail-template-copy-once.js:27-35`: `BODY_CASES` is "the records the golden bodies were cut from", and the `describe('the bytes a crawler is served do not move')` loop asserts `buildSeoBody(BODY_CASES[k]) === GOLDEN_BODIES[k]`. So re-cutting means running that same function over those same records, not hand-patching JSON.
- Nothing else in either repo's backend tests pins the column tag: `wsk-main` appears only in `skeleton.js`, the fixture, and a gitignored `.bmad-edge-scratch/` copy.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `npx mocha --exit --require @babel/register tests/edge-detail-skeleton.js` -- expected: pass, including the new landmark pin (exactly one `<main`, no `<div class="wsk-main"`).
- `npx mocha --exit --require @babel/register tests/detail-template-copy-once.js` -- expected: pass against the re-cut fixture and against the published copy in `WiSaw.client`.
- `npx mocha --exit --require @babel/register tests/seo-crawler-contract.js` -- expected: pass, its `<div id="root">` / script-count assertions unmodified.
- `npx mocha --exit --require @babel/register tests/inject-meta-tags.js` and `... tests/static-route-copy-once.js` -- expected: pass (anchor safety and static copy untouched).
- `node scripts/publish-detail-template.js` -- expected: prints `wrote .../WiSaw.client/src/utils/detailTemplate.generated.js`.
- `npm test` -- expected: green except the 5 documented pre-existing `getSeasonBoundaries` timezone failures on main; report actual counts.
- `npm run lint` -- expected: no ts-standard errors; report actual result.

**Manual check:** diff the re-cut fixture bodies against baseline — for every record the only byte change is `<div class="wsk-main">`→`<main class="wsk-main">` and its closing tag; SERP-visible strings (h1, description `<p>`, label links, nav) must be byte-identical.

**Actual results (run by the WiSaw.client operator after the delegated turn ended in an API error mid-work — the code was complete and uncommitted, so verification and commit were finished here rather than re-delegated):**
- `npm test` → **429 passing, 6 failing**. The six are pre-existing: a pristine `git archive HEAD` copy of this repo, with none of these changes, fails exactly the same set (5× `getSeasonBoundaries` timezone expectations in `tests/season-key.js`, 1× `the bucket a page is rendered from` in `tests/edge-detail-truthfulness.js`). Re-running those two suites in the working tree gives an identical 42 passing / 6 failing.
- The suites this change owns — `tests/edge-detail-skeleton.js` (including the new `landmarks on the served detail page` block), `tests/detail-template-copy-once.js`, `tests/seo-crawler-contract.js`, `tests/inject-meta-tags.js`, `tests/static-route-copy-once.js` — all pass, so the re-cut fixture and the published copy in `WiSaw.client/src/utils/detailTemplate.generated.js` agree with the renderer.
- `npm run lint` → ts-standard cannot run as-is inside the operator's sandbox: it writes its cache under `~/.cache/ts-standard`, which is outside the workspace (`EPERM`). Re-run with `HOME` pointed at a writable directory, it reports **1191 messages — byte-for-byte the same count as the pristine HEAD copy**, i.e. this change adds no lint findings on top of that repo-wide baseline. Nothing here can honestly claim "no ts-standard errors" for this repo today.
- **Manual fixture diff:** for all six golden bodies the only changes are `<div class="wsk-main">` → `<main class="wsk-main">`, its closing tag, and one appended `<div class="wsk-slot-footer" data-wisaw-slot="footer"></div>` after `</main>`; every h1, description paragraph, label link and nav string is byte-identical.

**Cross-repo follow-through (WiSaw.client side of C6b):** `src/utils/detailSkeleton.js` now reads the optional slot as `footerSlot` and `PhotosComponent` portals the site footer into `frame.footerSlot ?? frame.belowSlot`, so an older edge's frame still gets its footer while a current one keeps it outside `<main>`. Pinned there by `src/a11yLandmarks.test.js` and `src/containers/PhotosComponent.cls.test.js`.

## Review Triage Log

No review lens ran: the delegated turn that would have run the workflow's review step ended in an API error before reaching it, and the change was verified directly instead (counts above). Risk recorded as `high` because it changes bytes served to every media page; mitigations are the two green parity suites on both sides, the additive-only footer slot, and ship order (client guard first — see brief §10).
