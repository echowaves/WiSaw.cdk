---
id: 6
type: "story"
title: "One SEO text source serves the sitemap, the edge head and the app"
parent: seo-indexing
covers: []
after: [4, 5]
assignee: ""
refined: true
hitl: true
risk: high
---

# One SEO text source serves the sitemap, the edge head and the app

## Description

The same wording rules — month naming, word-boundary truncation, splitting a title from a caption, per-field budgets — are written three times: once for the edge, once as a deliberate mirror inside the storage-side enrichment writer, and once in the app. They have already drifted apart on character budgets. Because the app's copy is what a rendering crawler finally sees, the edge's careful budgeting is currently decorative. This ticket makes one source of truth for SEO text and has every surface read it: the enrichment writer produces finished strings when media is processed, the edge renders what it is given instead of re-deriving it, and the app stops composing SEO text and displays what it is handed. A person must settle two things in this ticket, which is why it is not fully delegated: how one module can be shipped into both the compiled backend build and the self-contained edge bundle, and approval to delete the app's own text builders once the served head carries the text (ticket 4 makes that safe).

## Acceptance Criteria

1. Given a short word list and a tight character budget, when truncation runs in the enrichment writer and at the edge, then both return the same string, proving one implementation answers both.
2. Given any photo or video, when its page is compared cold against hydrated, then title, meta description and `og:title` come from the same source and are byte-identical.
3. Given media being processed, when its enrichment record is written, then that record already holds the final title, description and caption strings, and the edge renders them without truncating or splitting text itself.
4. Given anything the edge cannot know in advance — the stored file's extension, a duration recorded on the object — when the head is built, then those are still resolved live, and nothing else re-derives text.
5. Given the app's own SEO text builders, when this ticket lands, then they no longer exist, and their unit tests now cover whichever module owns those rules.
6. Given a fabricated value in any head — an invented duration, a release date set to render time — when that page is rendered, then it carries the real stored value or omits the tag.
7. Given the breadcrumb structured data on a media page, when it is validated against the provider's own requirements, then every level except the last carries a working `item`, and no two levels share one target.
8. Given the whole corpus, when heads are produced after this change, then no page loses text it has today: sample pages across commented, labelled, comment-only and label-only media keep a non-empty title and description.

## Boundaries

- The tag set stays semantically what crawlers see today apart from the corrections named in these criteria; no new properties, no reordering.
- The client template keeps exactly one mount point, as pinned by its existing contract test.
- No GraphQL schema or resolver changes here: the fields the app needs already reach it. Serving them through a dedicated field is separate work in this initiative.
- The enrichment record's key and versioning contract stays byte-exact for all parties that share it.

## References

- parent — `_bmad-output/seo-indexing/tickets/tickets.toml`
- validation — `_bmad-output/seo-indexing/validation-seo-head-consistency.md`, "Structural duplication (independent of values)" items 4-6 and "What to simplify (decided, with reasons)"
- tests — `tests/sitemap-image-text.js`, `tests/upload-seo-sidecar.js` and `tests/inject-meta-tags.js`, the three consumers whose text must agree
- decision — `_bmad-output/seo-indexing/.memlog.md`, 2026-11-07 sidecar lifecycle simplification, four parties sharing the enrichment record
- tests — `src/seo.template.test.js` in WiSaw.client, template and injector contract pinned today

## Notes

- Risk high: this rewrites the text shown for every indexed page and touches three surfaces at once. Check outside these criteria (the human check): after deploy, compare a sample of twenty live pages — commented, labelled, comment-only, label-only — cold against hydrated, and confirm titles and descriptions are unchanged or improved before considering the ticket closed.
- Waits on seo-indexing/4 because: until the served head survives the render, deleting the app's builders removes the only text a rendering crawler ever sees. Also waits on seo-indexing/5 because both change how media file names are decided.
- Decision 2026-11-10 (User): one shared plain-JavaScript module that both builds load; no generated compiled copy.
- Remaining human step when this ticket starts (named in Description): approve deleting the app's own text builders — safe only once seo-indexing/4 has shipped, because until then the app's copy is the only text a rendering crawler ever sees.
- Assumption: the enrichment record written at upload time can carry finished strings without changing its key or version rules for the other parties that read it. Confirm while planning.
- Assumption: no duration field is added to the enrichment record; a duration recorded on the stored object stays the only source, which is why criterion 4 keeps resolving it live. Offer to the user before implementing.
- The app-side half of criteria 5 to 7 is executed in WiSaw.client and must be recorded there so both repositories carry the same contract.
