# Validation: SEO head consistency across backend, client, and SPA re-render

Date: 2026-11-10. Method: read-only trace of both repos plus the installed Helmet
library's client reconciliation code. No code was changed by this validation.

Scope: every place that writes or rewrites `<title>`, `meta`, `link rel=canonical`,
or JSON-LD for wisaw.com — the Lambda@Edge injector in this repo, the S3 app shell and
per-route Helmet blocks in `WiSaw.client`, and `@dr.pogodin/react-helmet`'s client
runtime.

Question asked: are the tags consistent across backend, front end, and the dynamic SPA
update; is the head initialised correctly on the first response so it needs no later
manipulation; where is the complexity and duplication worth removing.

## Verdict

**Not consistent.** The backend now produces a good crawler-visible head on the first
byte (this initiative's earlier tickets did that), and then the client throws it away:
on every page, React Helmet deletes the injected tags and writes its own with different
values within the first render. Google renders JavaScript, so for a JS-capable crawler
the *client* text is what wins — which means `seoText.js`'s careful title/description
budgeting, the `og:image:title`/`og:image:caption` pair, and the no-fabrication rules are
all invisible in practice on `/photos/*` and `/videos/*`.

The head is also **duplicated by construction** in three ways that do not depend on
values: tags the template ships without `data-rh` can never be reconciled away, the same
copy exists twice with different wording (edge route table vs client Helmet), and the
same text rules exist twice inside this repo (`seoText.js` vs `seoSidecar.ts`, with
"mirrors the edge copy" comments admitting it).

Complexity itself is not excessive — ~1000 lines of edge code and ~200 lines of client
SEO JSX. The cost is in **four parallel definitions of one contract**: `index.html`
template, `static.js` ROUTES, `utils.js` injectors, and six client containers. Every one
of them drifts independently and nothing tests them against each other.

## How the reconciliation actually works (why "manipulate less" is a code fact, not a preference)

`node_modules/@dr.pogodin/react-helmet/build/common/client.js`:

- `updateTags()` selects existing nodes with `` `${type}[data-rh]` `` — **only tags that
  already carry `data-rh` are visible to Helmet**. Template tags without it are never
  updated, never deduped, never removed.
- A visible old tag is kept only if `newElement.isEqualNode(oldTag)` — exact match on
  every attribute. Any difference in wording means *remove + append*: a full rewrite of
  the whole SEO set on first mount.
- `Helmet.js:196-198` unmount calls `context.update(id, undefined)` then `clientApply()`,
  so navigating away removes that page's tags; `PhotosComponent.js:840` renders its
  `<Helmet>` only once `currPhoto.photo` **and** both dimensions are known, so during a
  client-side navigation there is a window with no canonical and no og at all.

Consequence for the goal "initialise correctly the first time": any tag whose value the
client also computes must be byte-identical to what the edge wrote, or it counts as
manipulation. Today **none** of them are.

## Consistency matrix — media pages (`/photos/<id>`, `/videos/<id>`)

| Tag | Edge (first response) | Client (after hydration) | Verdict |
|---|---|---|---|
| `title` | `"Golden retriever on the beach — photo, Brooklyn, Sep 2025 · WiSaw"` (`seoText.js:96-113`) | first 3 AI labels, or `WiSaw Video <uuid>` (`PhotosComponent.js:871`, `:846-858`) | conflict; client drops the unique caption |
| `og:title` | same as title | title **plus a raw UUID appended** (`:873-875`) | conflict |
| `description` / `og:description` | one lead + place/month + brand sentence, ≤158 chars | first comment + 5 labels sliced to 150, or labels only | conflict |
| `og:image` | `https://img.wisaw.com/<id>.webp` (`utils.js:379`) | `<id>-thumb.webp` (`PhotosComponent.js:881-885`, built in `lambda-fns/models/photo.ts:26`) | two different images for one page |
| `og:image:title` / `og:image:caption` | published, deliberately different texts | not emitted at all → removed on hydration | signal lost for JS-rendered fetch |
| `og:type` | `photo` / `video` (`photo.js:65`, `video.js:72`) | `article` / `video.other` (`:906`, `:895`) | four values for two page types; edge `video` is not a valid OG type, client `article` on a photo page is wrong too |
| `og:url` + canonical | lower-cased id, no trailing slash (`utils.js:372-390`) | same shape from `photo.id` | only row that agrees |
| `twitter:card` | always `summary_large_image` | `player` for videos, with `twitter:player*` | conflict; client version is the better one for videos |
| `twitter:title` | page title | first comment (`:914-921`) | conflict |
| `robots` | header `X-Robots-Tag: index, follow` only | `max-video-preview:30` on videos; template tag (no `data-rh`) says `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` and can never be replaced | three sources of robots directives per page |
| `video:duration` / `video:release_date` | only when real data exists (`seoText.js` refuses to invent) | hardcoded `30`, and `new Date().toISOString()` as release date (`:945-947`) | client publishes fabricated metadata the backend was written not to publish |
| JSON-LD photo | `Photograph` in `<body>` (`utils.js:301-313`) — removed by hydration | `ImageObject` in `<head>` (`:993-1026`) | different schema type per crawler; `width`/`height` fabricated as 640×360 fallbacks |
| JSON-LD video | `VideoObject`, `uploadDate`/`duration` omitted when unknown | `VideoObject` with `duration: 'PT0M30S'`, `uploadDate: now` fallback, `videoQuality: 'HD'` | same type, contradictory values |
| `BreadcrumbList` | not published | position 2 `item: https://wisaw.com` for the Photos/Videos listing, and position 3 has no `item` (`:1028-1052`) | invalid: two ListItems resolving to the homepage URL |

## Consistency matrix — static routes (`/`, `/about`, `/contact`, `/terms`, `/search`)

| Route | Edge title (this repo) | Client title | Other conflicts |
|---|---|---|---|
| `/` | `Free Stock Photos & Videos, Unaltered \| WiSaw` (`static.js:12-16`) | `Free Stock Photos & Videos -- What I Saw` (`Home.js:336`) | descriptions differ entirely; edge canonical `https://wisaw.com/`, client `https://wisaw.com`; client adds 3 JSON-LD graphs (WebSite/Organization/CollectionPage) the edge never sees |
| `/about` | `About WiSaw — unaltered photos and videos from phone cameras` | `Free Stock Photos & Videos -- What I Saw, about us` (`About.js:16`) | two full OG/Twitter blocks with different copy |
| `/contact` | `Contact WiSaw` | `Free Stock Photos & Videos -- What I Saw, contact us` (`Contact.js:16`) | as above |
| `/terms` | `Terms and Conditions — WiSaw` | `Free Stock Photos & Videos -- What I Saw, our terms and conditions` (`Terms.js:16`) | as above |
| `/search*` | noindex, `private, no-cache`, generic title | full OG block + self-canonical, **no noindex** (`SearchComponent.js:433-470`) | edge says "keep out" via header, client publishes a shareable canonical; the header still applies to the fetched document, so the two signals fight |

## Structural duplication (independent of values)

1. `index.html:88` ships `og:site_name` and `:99` ships `robots` **without** `data-rh`.
   Helmet can neither update nor remove them, while every container emits its own
   `og:site_name`, the edge injects its own with `content="wisaw.com"` (`utils.js:389` on
   media pages, `utils.js:488` on static routes),
   and video pages add a second `robots`. Result: two `og:site_name` tags ("WiSaw" and
   "wisaw.com") on every media page, permanently.
2. `stripExistingMetaTags` (`utils.js:28-40`) does not cover `og:site_name`, `og:locale`,
   or `robots`, so the edge cannot clean what the template left behind either.
3. Static-route copy exists twice with different wording (edge `static.js:5-42` vs six
   client containers) and nothing pins them together.
4. Text rules exist twice **inside this repo**: `lambda-fns/utilities/seoSidecar.ts:118-172`
   re-implements `monthYear`, word-boundary truncation, and the title/caption split from
   `injectMetaTagsLambdaFunction/seoText.js`, with comments noting it is a mirror. Cause:
   `lib/resources/lambdas.ts:300-348` ships the edge folder with `AssetCode.fromAsset`, so
   the edge bundle cannot import TypeScript from `lambda-fns/utilities`.
5. Media URL/extension rules exist three times: `media.js:13` (`VIDEO_EXT_RE`, used to pick
   the real object), `generateSiteMap/index.ts:133` (hardcodes `<id>.mov` for
   `content_loc`), `models/photo.ts:26` (`thumbUrl`). A video stored as `.mp4` gets a valid
   `og:video` from the edge and a broken `content_loc` in the sitemap.
6. The sidecar has no `duration` field (`seoSidecar.ts:23-28`), so `seo.duration` is always
   empty and the only real duration comes from S3 user metadata in `media.js:readDuration`.

## What to simplify (decided, with reasons)

**One author per route class, initialised on the first response.**

- Media pages: the **edge owns** the head — it is the only place that has the sidecar, the
  real media key, and no dependence on JavaScript. The client must stop re-authoring those
  values; on a fresh load its job is to leave them alone, and on SPA navigation (prev/next,
  feed → detail) it must reproduce *the same strings*, which means consuming them rather
  than recomputing them: expose the sidecar text as a `seo` object on `Photo` in GraphQL.
- Static routes: the **edge owns** the crawler-visible copy; the client's copy is generated
  from the same published table instead of hand-written per container.
- One shared JS module holds the text rules, consumed by the sitemap writer, the edge
  injector, and (through GraphQL) the client. Delete the mirrored copies.
- Template ships **no** SEO-bearing tags except `charset`, `viewport`, `robots` (with
  `data-rh` so it is manageable or explicitly permanent), icons, and preconnects. Titles,
  OG and Twitter belong to the edge + generated client module, never to `index.html`.

This removes: two title/description builders on the client, one duplicated text module in
this repo, three extension rules → one, and ~120 lines of per-container OG/Twitter JSX. It
does not add abstraction beyond one shared module: the fields the app needs already reach it, so
no new API surface is proposed.

## Tickets raised here

`tickets/tickets.toml` entries 4–7: `bug-edge-head-tags-rewritten-by-spa`,
`bug-sitemap-video-extension`, `story-seo-text-single-source`,
`story-static-route-copy-once`. Entry 6 waits on both bugs because it edits the same media-naming
and text surfaces. Each ticket that changes app behaviour names its client-repo half in Boundaries;
that half must be mirrored into `WiSaw.client`'s own ticket tree before either side ships, since
4/6/7 only pay off when both sides move. Client-side notes are recorded meanwhile in
`WiSaw.client/_bmad-output/deferred-work.md`.

## Sweep result (2026-11-11) — after tickets 4-8 shipped

The consolidation this document asked for is in place, checked module by module rather than
assumed:

- **Text rules**: `seoRules.js` is the only implementation. `seoText.js` survives as a thin
  renderer that uses stored strings verbatim, and both writers (`utilities/seoSidecar.ts`,
  `scripts/publish-seo-sidecars.js`) call the same functions — proven by identity, not by
  comparing output. The app's own builders are gone; no file in `WiSaw.client/src/utils` is
  unreferenced, so nothing was left behind when they were deleted.
- **Naming**: one `mediaNaming.js` serves the sitemap generator, the edge head and the API path.
- **Duration**: one parser (`utilities/videoDuration.js`) plus one normaliser pair in `seoRules.js`
  feed the edge tag, JSON-LD and the sitemap; the app mirrors the normaliser and a contract test
  pins both copies against the real backend module.
- **Static copy**: authored once in `static.js`, published into the app by
  `scripts/publish-static-seo.js`. The two budget vocabularies (page slots 68/158, Google Image and
  sitemap slots 100/512) deliberately remain two: unifying the numbers would silently rewrite
  published sitemap text.
- **No orphans**: every module these tickets added is required by a live path — edge injectors,
  `generateSiteMap`, the sidecar writer, or an operator script.

The open question left in ticket 7's Notes ("no separate sweep story was added") is answered here:
the sweep happened inside tickets 6 and 7, and this section is its record.
