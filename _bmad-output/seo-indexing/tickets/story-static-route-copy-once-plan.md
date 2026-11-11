---
type: 'feature'
ticket: '7'
status: built
created: 2026-11-10
updated: 2026-11-10
spec: ../spec.md
---

# Static-route copy is authored once, at the edge, and published to the app

Plan for ticket `7` (`story-static-route-copy-once`). Medium risk: four branded pages plus the
search exclusion contract. Backend-first, then a generated file in the app, then the app reads it.

## Intent

Home, About, Contact and Terms have their title, description and canonical written twice — in the
edge route table (`static.js`) and inside each page's `<Helmet>` block — with different wording, so
a crawler that does not run JavaScript and a browser see two different documents at one URL. Search
results are worse: the edge excludes them and serves them uncacheable while the app publishes a
self-canonical and full share metadata with no exclusion. Hygiene in the same contract: `og:locale`
in the template carries no `data-rh`, so nobody can update or remove it, and the edge cleaner does
not strip it before injecting its own tags (it injects none, so the property is currently a
template-only leftover on every page).

## Decisions

> **Agent decision (2026-11-10).** The ticket asks one thing of a human — which single-copy
> mechanism — and no answer arrived inside the build window. Recorded here for review; each is
> reversible without touching data.
>
> 1. **Mechanism: the edge route table is the authored source, and a committed generated module
>    carries it into the app.** `scripts/publish-static-seo.js` renders every static route's copy
>    into `WiSaw.client/src/utils/staticSeo.generated.js`; the app imports that file, and a backend
>    test fails if the committed copy no longer matches the table. The alternatives were rejected
>    for concrete reasons: a build-time import of the sibling repository would make `npm run build`
>    depend on another repo being checked out at a matching commit (deploys here are manual, so that
>    is a foot-gun), and a drift-only contract test still leaves the text written twice, which is
>    what criterion 2 forbids. Direction is edge → app because the Lambda@Edge bundle cannot import
>    from the client at build time.
> 2. **`og:locale` becomes edge-owned and Helmet-manageable.** The cleaner strips it, both injectors
>    emit `en_US` with `data-rh`, and every route in the app declares it — the same treatment ticket
>    4 gave `og:site_name` and `robots`. Marking it without declaring it would make Helmet delete
>    the only copy on hydration, so the app-side declarations are part of this decision, not a
>    follow-up.
> 3. **Search-result URLs self-canonicalise instead of collapsing to `/search`.** The app already
>    publishes `https://wisaw.com/search/<term>` while the edge published `/search` for every term;
>    that is ticket 4's deferred collapse item. Both sides now derive the URL from one template in
>    the route table, and the exclusion stays exactly as it is (User decision 2026-11-10: search
>    pages remain excluded).
> 4. **Static routes gain a share image at the edge.** `stripExistingMetaTags` has always removed the
>    template's `og:image`, and the route injector never put one back, so every static page has been
>    served to crawlers without an image while browsers got the app's. The route table now carries
>    the brand image and the route injector emits `og:image` plus the Twitter pair, which the app
>    already declares — same value, both surfaces.

## Actions

1. `utils.js` — add a `LOCALE` constant, strip `og:locale` in `stripExistingMetaTags`, emit it with
   `data-rh` beside `og:site_name` in both the media body and the route body, export `LOCALE`.
2. `static.js` — keep the wording as data (`title`/`description`/`canonical`/`image`), add the
   per-term templates for `/search`, and build the head from them when a term is present; export
   `ROUTES` and `routeFor` so tooling can read the table instead of parsing it.
3. `scripts/publish-static-seo.js` (new) — `renderStaticSeoModule()` produces the app module text
   from the table (header says generated, do not edit); running it writes the file into the sibling
   checkout and refuses politely when that checkout is absent.
4. App — Home, About, Contact, Terms render title/description/canonical/og/twitter values from the
   generated module; Search does the same for its base copy and substitutes the term through the
   generated templates; every route declares `og:locale`; the template's `og:locale` gains `data-rh`.
5. Tests — backend `tests/static-route-copy-once.js`: cleaner removes stale site-name/locale/robots
   from an old template; locale appears exactly once in a media head and in a route head; search term
   gets self-canonical, per-term title and `noindex` in the first byte; the committed app module
   matches the table. Client: the four pages' hydrated head equals the edge copy, and site name,
   locale and robots each appear exactly once after hydration.
6. Record the outcome in the ticket leaf (criteria ticks, decisions, validation), memlog, and clear
   the matching `WiSaw.client/_bmad-output/deferred-work.md` entries.

## Acceptance criteria mapping

- Criterion 1 → Actions 2 + 4: one table supplies both sides, so equality is structural; the client
  test asserts it for all four pages rather than trusting the mechanism.
- Criterion 2 → Action 3 with the dated decision above (mechanism named).
- Criterion 3 → `noindex` already holds in the first byte (`static.js`) and in the app (ticket 4);
  tests now pin both sides plus the X-Robots-Tag agreement.
- Criterion 4 → Actions 1 + 4: strip, re-own with `data-rh`, declare on every route; asserted per
  page type after hydration.
- Criterion 5 → Action 1's cleaner pattern for all three properties, tested against a template that
  still carries the old unmarked tags.

## Validation policy

Backend targeted file plus the full suite (`npm test`) — expect only the five pre-existing
`getSeasonBoundaries` timezone failures; `npx tsc --noEmit -skipLibCheck`; `ts-standard` on touched
TypeScript (needs `HOME="$TMPDIR"` in this sandbox, which blocks `~/.cache`). Client: `npx vitest
run`, `npx eslint` on touched files (delta against the 17 pre-existing problems), `npm run build`
whose `postbuild` runs the template contract. No review lens ran: the subagent endpoint in this
harness answers `400 The requested model is not supported`, so this ticket has no independent
review pass and its self-review is the test suite.
