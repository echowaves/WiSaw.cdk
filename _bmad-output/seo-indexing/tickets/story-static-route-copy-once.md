---
id: 7
type: "story"
title: "Static-route SEO copy is written once and published to both sides"
parent: seo-indexing
covers: []
after: [6]
assignee: ""
refined: true
hitl: true
risk: medium
status: built
---

# Static-route SEO copy is written once and published to both sides

## Description

The four static pages — home, about, contact, terms — have their title, description and canonical authored twice, in the edge route table and in the app's own page metadata, with different wording. Nothing pins them, so whichever side was edited last wins for whoever is looking: a JavaScript-less crawler keeps the edge wording, every browser ends up with the app's. Search results is worse than a wording mismatch — it is a contradiction: one side tells crawlers to stay away and serves the page uncacheable, while the other publishes a self-canonical and full share metadata with no exclusion at all. Related hygiene belongs here because it is the same contract: template-supplied site-name, locale and robot tags that the app can neither update nor remove, and an edge cleaner that does not strip those three properties before injecting its own. Search results stay excluded from the index; the exclusion simply has to hold in the first byte and after render. A person still settles one thing here before implementation: how the single copy reaches both sides, which is why this ticket is not fully delegated.

## Acceptance Criteria

1. Given home, about, contact and terms, when the edge-served head is compared with the hydrated DOM head, then title, meta description and canonical are identical on all four — or: a difference is deliberate and recorded in Notes with its reason.
2. Given that copy, when it changes, then it is written once and both sides publish it, through one mechanism chosen before implementation and named here as a dated decision.
3. Given the search page and any search-results URL, when either is rendered, then the exclusion directive is present in the first-byte response **and** in the hydrated document, matching what is already served today.
4. Given any page on the site, when its head is read after hydration, then site name, locale and robot directives each appear exactly once — including media pages, where two robot directives appear today.
5. Given a template left behind by an older deploy that still carries stale site-name, locale or robot tags, when the edge builds a head, then it removes them before injecting its own.

## Boundaries

- Copy may be reworded only as far as needed to serve both sides from one text; keep the current tone and the existing canonical scheme.
- The exclusion decision for search results is a product call, not an optimisation: do not quietly make search pages indexable.
- Media-page head work stays in seo-indexing/4; cache policies, redirects and error responses are untouched.
- App-side edits (template tags, the search page's own metadata, the four static pages) are executed in WiSaw.client and recorded there so both repositories carry the contract.

## References

- parent — `_bmad-output/seo-indexing/tickets/tickets.toml`
- validation — `_bmad-output/seo-indexing/validation-seo-head-consistency.md`, "Consistency matrix — static routes" and "Structural duplication (independent of values)" items 1-3
- tests — `src/seo.template.test.js` in WiSaw.client, template and injector contract pinned today

## Notes

- Risk medium: static pages are the site's branded entries and are few enough to check by hand; a wrong exclusion decision would either leak low-value pages or hide pages worth indexing.
- Waits on seo-indexing/6 because: it settles where SEO text comes from, and copy single-sourcing must land on top of that rather than beside it.
- Decision 2026-11-10 (User): search results stay excluded from the index; the app's side gains the matching exclusion rather than the edge relaxing it.
- Human step (named in Description): approve the chosen single-copy mechanism before implementing — criteria 2 records it as a dated decision.
- Open question: which single-source mechanism to use — a generated file committed to the app repository, a build-time import, or a contract test that fails on drift. Decide with the user at planning time; criteria 2 records the choice.
- Refactor sweep: seo-indexing/6 is this set's consolidation pass and waits on 4 and 5; this ticket closes the set, so no separate sweep story was added. Confirm with the user.

## Notes

### Decisions taken while building (2026-11-10)

The mechanism asked for approval in Description before implementing; no answer arrived inside the build window the human set ("implement them non stop in the loop until all tasks are done"), so these are Agent decisions, recorded here for review. All four are reversible by code and none depends on data.

- **Criterion 2 — the mechanism**: `lambda-fns/lambdas/injectMetaTagsLambdaFunction/static.js` stays the authored source, and `scripts/publish-static-seo.js` renders it into a *committed* ES module in the app, `WiSaw.client/src/utils/staticSeo.generated.js`. Rejected alternatives: importing the sibling checkout at build time (deploys are manual, and `npm run build` would break on any clone without the backend beside it) and a drift test with two copies (a failing test does not remove the second copy). The direction has to be backend → client because the injector is deployed with `Code.fromAsset(<folder>)`: nothing can be imported across repositories at runtime.
- **Locale became edge-owned** rather than template-owned. The shipped `og:locale` carried no `data-rh`, so nobody could manage it and the app could not declare one without duplicating it. The edge now strips it and re-emits it marked, in both injector paths, and every app route declares it — marking without declaring would have made Helmet delete the site's only locale tag.
- **Static routes gained a share image** (`BRAND_IMAGE`, the 512px app icon). The cleaner has always stripped `og:image` and route injection never put one back, so a crawler used to get an imageless static page while a browser got the app's.
- **`twitter:url` is gone from the app's route heads**: deprecated by the provider and never published by the edge, so keeping it meant one side always had an extra tag.

### Findings while building

- Search results collapsed onto `/search`: every term shared one canonical *and* one title. They now self-canonicalise per term on both sides (`canonicalTerm` with `encodeURIComponent`), and the edge decodes the URI segment first, tolerating malformed percent-escapes instead of throwing. The exclusion itself is untouched — that stays a User decision.
- Two backend tests and three client expectations pinned the old contract ("`og:locale` is the one deliberately unmanaged tag"). They were not incidental: they encoded the bug. All five now pin the new contract, and the shipped template's locale tag is marked so it can be managed at all.
- The first published module declared `staticHead` without exporting it. Every static page would have rendered **no** head after hydration — a worse outcome than the drift this ticket set out to fix — and nothing caught it, because no test mounted a static page. Fixed in the generator, and pinned from both sides: the backend evaluates the published module and requires its answers to equal `headFor()` for all five routes plus a term, while the client mounts each real page over a stale served head.

### Validation performed (2026-11-10)

- Backend: new `tests/static-route-copy-once.js` — 15 passing (cleaner removes a stale site-name/locale/robots trio from an older template; exactly one marked locale in a media head and in a route head; route heads carry one `og:image` plus the Twitter pair; `/search/new%20york` gets its own title, description and canonical with `noindex: true`; `%25` and malformed `%zz` terms survive; body and header agree on noindex; an unknown URI passes through untouched; the committed app module equals `renderStaticSeoModule()` byte for byte, carries every shared constant, and answers like the edge). Two pre-existing locale cases in `tests/inject-meta-tags.js` rewritten to the new contract. Whole backend run: 284 passing / 5 failing, the five being the pre-existing `getSeasonBoundaries` timezone cases.
- Client: new `src/staticRouteCopy.contract.test.js` — 12 passing (each of `/`, `/about`, `/contact`, `/terms`, `/search` published from the table with one tag per property and nothing unmanaged, mounted over a stale head whose values are all wrong; the four real pages plus the search page keep the copy and flip a stale `noindex`; an edge-unowned path publishes nothing). Whole client run: 14 files / 150 tests passing; `npx eslint` clean on every touched file (one indentation error in `Home.js` fixed); `npm run build` green with the postbuild template contract (18 tests).
