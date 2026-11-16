---
title: 'Edge detail page answers only with objects and dimensions that exist'
type: 'bugfix'
ticket: ''
created: '2026-11-15'
status: 'in-review'
baseline_revision: 'bee3ca164d759f1623bb544767cb8f9871677bbd'
route: 'oneshot'
route_source: 'pinned'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context: ['_bmad-output/seo-indexing/plan-edge-detail-skeleton.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The reviewer pass over `2f8ae04..241ac54` found the edge detail injector answering with things that are not there. A `/videos/<id>` URL whose storage holds only a photo publishes `og:video`, `VideoObject.contentUrl` and a `<video src>` naming an `<id>.mov` that was never written (403), because `videoObjectKey()` falls back to the first extension when storage says nothing about kind. An id whose media is deleted but whose `<id>.json` sidecar survives answers 200 with a broken image, because `probeMedia` counts the sidecar as an object. A record whose dimensions failed to extract publishes `width="0"` (`seoRules.js` yields the string `"0"`, which is truthy) instead of declining. Around those: `fetchSidecar` negative-caches `null` for 10 minutes on *any* error (throttling or AccessDenied silently strips titles at a POP), `sidecar.js` keeps a private copy of the coordinate guard that `seoRules.js` already exports, `VIDEO_OG_TYPES` hand-duplicates `mediaNaming.VIDEO_EXTENSIONS`, `stripExistingMetaTags` does not strip `og:video*`, the backend's structural fixture predates the client's `#wisaw-app` mount container, and every cross-repo pin in `tests/edge-detail-skeleton.js` turns into `it.skip` outside a side-by-side checkout.

**Approach:** Make the injector publish only what storage proves exists — kind by object key rather than by URL, existence ignoring the sidecar, dimensions only when they are positive integers — and delete the duplicated rules so there is one writer per fact. Keep every fix inside `injectMetaTagsLambdaFunction/` plus its tests; the client adopts whatever bytes come out.

## Boundaries

- No changes in WiSaw.client, and no change to what `captureDetailSkeleton` accepts: a page with no honest box still declines adoption.
- No sidecar **writer** or bucket-resolution changes — that is goal G3 (`deferred-work.md` entry 9). Only the reader side of `<id>.json` is touched here.
- No CloudFront/CDK infrastructure changes, no CORS work (G4), and no `cdk deploy`/S3 writes: verify with mocha only.
- Byte-exact head/body cases in `tests/inject-meta-tags.js` and `tests/seo-crawler-contract.js` stay green; they are the reason this surface is safe to touch at all.

## I/O matrix

| Input | Current answer | Required answer |
|---|---|---|
| `/videos/<id>`, storage has `<id>.webp` + `-thumb.webp` + `<id>.json` | 200 with `og:video*` + `<video src="<id>.mov">` (403 object) | 301 → `https://wisaw.com/photos/<id>` |
| `/photos/<id>`, storage has only `<id>.mov` (+ thumb) | 200 with `og:image` naming `<id>.webp` (403 object) | 301 → `https://wisaw.com/videos/<id>` |
| `/videos/<id>`, storage has `<id>.mp4` | unchanged: names the `.mp4` | unchanged |
| any detail id, listing holds only `<id>.json` (or nothing) | 200 with broken media | 404 + `noindex` |
| any detail id, S3 answers AccessDenied / throttle | 200 (inconclusive) | 200 (unchanged — never a false 404) |
| sidecar read fails with AccessDenied/timeout | cached `null` for 10 min at that POP | not cached; retried on the next request |
| record `width:"0"` / `width:"abc"` / missing | `width="0" height="0"` in the media element | no `width`/`height`, square reserve |
| dim-less record, desktop viewport | box capped at 700 px square | box capped at 300 px square (React's own fallback) |
| shell already carrying `og:video*` from a previous deploy | survives the strip pass | stripped, injected copy wins |

## Resolved Decisions

- Cross-kind URL → **301 to the true kind** (human, 2026-11-15): keeps link equity, tells the crawler the truth, and reuses the canonicalisation intent already in `redirectLambdaEdgeFunction`. Only when storage proves the other kind; a record with neither a full image nor a video object never redirects, so no loop is possible.
- Media gone with the sidecar left behind → **media is gone**: 404 + `noindex`, which is the same answer the id already gets when the listing is empty.
- Dim-less reserve → **match React's 300×300 fallback** (`WiSaw.client/src/containers/PhotosComponent.js:743`) instead of a 700 px square, so a page that declines adoption does not repaint at a different size.
- `data-wisaw-route` in the previous plan's decision list was never emitted and nothing reads it → correct the **document**, not the markup (T11).

</frozen-after-approval>

## Implementation Notes

Oneshot route: one goal (the detail injector never names a thing that is not there) across six modules in one folder plus their tests. Highest-risk item is T1 — it changes crawler-visible status codes on ~21k URLs, so it gets the most test coverage and needs the redirect guard against loops spelled out. Everything else is either a truthfulness guard or a de-duplication that must not change bytes for any currently-correct page (that is exactly what the byte-exact pins check).

## Code Map

| File | Role here |
|---|---|
| `lambda-fns/lambdas/injectMetaTagsLambdaFunction/media.js` | `probeMedia`: ignore sidecar objects when deciding existence/kind; report image/video presence |
| `…/video.js`, `…/photo.js` | kind truthfulness (301), 404 on media-gone, duration read only for a real video key |
| `…/mediaNaming.js` (+ `.d.ts`) | own extension→MIME map as the single source; derive `VIDEO_EXTENSIONS` from it |
| `…/utils.js` | `positiveInt` dims in `mediaElement`; import MIME map instead of `VIDEO_OG_TYPES`; strip `og:video*` in `stripExistingMetaTags`; `playsinline`; boot-critical mount containers |
| `…/skeleton.js` | export `positiveInt`; dim-less reserve 300 px |
| `…/sidecar.js` | import `PRECISE_KEYS`/`isPreciseLocation` from `seoRules.js`; cache only definitive misses |
| `tests/edge-detail-skeleton.js` | kind redirects, dims, playsinline, sidecar-only id, loud cross-repo pins, fixture assertions |
| `tests/inject-meta-tags.js`, `tests/seo-crawler-contract.js` | `og:video*` stripping, byte-exact regression, guard-single-source pin |
| `tests/fixtures/served-index.html` | refresh from the shipped client shell (carries `#wisaw-app`) |

## Tasks

- [x] **T1 Kind is what storage holds, not what the URL says.** Give `probeMedia` a truthful shape (`hasImage` on a non-thumbnail image object, `hasVideo` on a video object key) and use it: `video.js` 301s to `/photos/<id>` when `!hasVideo`, `photo.js` 301s to `/videos/<id>` when `!hasImage && hasVideo`; both keep the existing 200 path whenever storage cannot prove the other kind. Redirect response: `status '301'`, `Location` on `https://wisaw.com`, `Cache-Control: max-age=86400`, and no redirect when neither kind is proved (thumb-only) so a listing oddity cannot loop.
- [x] **T2 Only publish dimensions that are sizes.** Export `positiveInt` from `skeleton.js`; in `utils.js` gate the media element's `width`/`height` attributes and every `og:image:width`/`og:video:width` pair through it, so `"0"`, `"abc"`, negatives and `NaN` publish no size at all instead of a zero.
- [x] **T3 A sidecar is not media.** In `probeMedia`, filter `<id>.json` out of the listing (via `mediaNaming.isSidecarObjectKey`) before deciding emptiness or preference, so a surviving sidecar cannot keep a deleted photo's page at 200. Replace the folder's inline `/\.json$/` tests with that one helper.
- [x] **T4 Never negative-cache a permission error.** In `fetchSidecar`, cache `null` only for `NoSuchKey`/`NotFound`; log and return `null` uncached for everything else (including a JSON parse failure).
- [x] **T5 One coordinate guard.** Delete `sidecar.js`'s private `PRECISE_KEYS`/`isPreciseLocation` and require both from `./seoRules` (already exported, no dependency cycle); keep `stripPreciseLocation` local and keep re-exporting the guard for `tests/seo-crawler-contract.js`.
- [x] **T6 One list of video extensions.** Move the extension→MIME map into `mediaNaming.js` as `VIDEO_MIME_TYPES` and derive `VIDEO_EXTENSIONS = Object.keys(VIDEO_MIME_TYPES)` (`.mov` first, so `videoObjectKey`'s documented fallback is unchanged); `utils.videoOgType` consumes it. Update `mediaNaming.d.ts`.
- [x] **T7 Strip what we inject.** Add the `og:video` family (`og:video`, `:url`, `:secure_url`, `:type`, `:width`, `:height`, `:duration`, `:image`) to `stripExistingMetaTags`, matching both quote styles and self-closing tags.
- [x] **T8 Make the fixture a real shell.** Regenerate `tests/fixtures/served-index.html` from `WiSaw.client/index.html` (mount containers, entry scripts, no stale markup), and extend `BOOT_CRITICAL_PATTERNS` so an injection pass that swallows `#root` **or** `#wisaw-app` trips the existing failsafe instead of shipping a shell React cannot boot in.
- [x] **T9 Loud skips.** In `tests/edge-detail-skeleton.js`, resolve the client shell path from `WISAW_CLIENT_PATH` (default `../../WiSaw.client/index.html`) and fail those cases with an explicit message when it is absent, instead of `it.skip` reporting green.
- [x] **T10 Cold-paint parity.** Emit `playsinline` on the skeleton `<video>` so a cold adopted page matches what React renders (client `45b1c56` sets it after adoption; the first paint should not need it).
- [x] **T11 Document truth.** Amend the `data-wisaw-route` decision recorded in `plan-edge-detail-skeleton.md` to say what ships: route kind travels in the URL and the head, not in a skeleton attribute.

## Implementation Notes (written during step 03)

- `probeMedia` answers are built by one `answer()` helper now, so the two kinds and the inconclusive
  path cannot drift apart field by field. `hasVideo` is read off the listing, never from
  `pickVideoObjectKey`: that function's documented fallback invents `<id>.mov`, which made every
  photo look like a video when asked through it (caught by a pin, not in review).
- `positiveInt` went from `parseInt` to `Number` + `Number.isSafeInteger`: `parseInt('12px')` yields
  12, and publishing 12 for a file that is not 12 px wide is the same class of lie as `width="0"`.
- The redirect lives in the injector (`utils.redirectResponse`), not in `redirectLambdaEdgeFunction`,
  because deciding kind needs storage and only the origin-response trigger sees it. Both handlers
  require positive proof of the other kind, so a thumb-only listing or an inconclusive S3 answer can
  never start a bounce between `/photos/<id>` and `/videos/<id>`.
- `tests/fixtures/served-index.html` gained only `<div id="wisaw-app"></div>` rather than a full
  refresh: the file is a snapshot of what production serves, and wholesale replacement would have
  silently re-blessed whatever changed on the site. The added sibling broke an existing hostile-shell
  test whose mutation anchor (`</div>\n</body>`) it displaced - that test now anchors on `</h2>` and
  asserts its own mutations applied, so it cannot go quiet again.
- New file `tests/edge-detail-truthfulness.js` (16 cases) is the first test anywhere in this repo to
  execute `photo.js` / `video.js` handlers, `probeMedia`, or `fetchSidecar`; those surfaces had no
  coverage before. Its S3 stub installs/restores explicitly - a stub that captures the prototype at
  creation time hands the next case the previous case's listing.

## Verification

- `npx mocha --exit --require @babel/register tests/edge-detail-skeleton.js tests/inject-meta-tags.js tests/seo-crawler-contract.js tests/media-naming.js` — baseline 134 passing on those files (plus media-naming), all green after, each new pin confirmed to fail on the pre-change tree.
- `npm test` full suite: only the 5 documented pre-existing `getSeasonBoundaries` timezone failures may fail.
- `npm run lint` (`ts-standard`) clean on touched paths.
- Manual reasoning pinned in tests rather than clicked: this surface cannot be exercised locally without AWS, so every branch of the I/O matrix above has a named test case.

- Full suite (`npm test`): **380 passing, 5 failing** - the five are the documented pre-existing
  `getSeasonBoundaries` timezone failures in `tests/season-key.js`, unchanged by this work.
- Edge surface (`edge-detail-skeleton`, `inject-meta-tags`, `seo-crawler-contract`, `media-naming`,
  `edge-detail-truthfulness`): **165 passing**.
- Every new pin was run against the pre-change tree (`git stash push -- lambda-fns/`): 11 of the 16
  truthfulness cases fail there, plus 7 in the two amended files. Nothing here asserts existing bytes.
- `npx ts-standard --no-cache <touched files>`: clean. `npm run lint` reports one pre-existing
  `no-unused-vars` in `seoRules.js:2`, untouched by this change (and its cache write needs a HOME the
  sandbox allows: `HOME="$TMPDIR/lint-home" npm run lint`).
