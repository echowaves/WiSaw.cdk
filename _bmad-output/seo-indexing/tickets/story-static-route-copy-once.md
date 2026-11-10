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
