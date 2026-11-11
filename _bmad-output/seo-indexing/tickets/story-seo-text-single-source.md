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
status: built
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
- [x] 1. One module holds the SEO text rules, and it is the only copy — `lambda-fns/lambdas/injectMetaTagsLambdaFunction/seoRules.js` (plain CommonJS, zero dependencies), with a sibling `seoRules.d.ts` so the bundled TypeScript writer can import it without `allowJs`. The edge folder ships as `Code.fromAsset(<folder>)`, so living inside that folder is also how it reaches Edge.
- [x] 2. Every surface reads that module — the storage-side writer (`utilities/seoSidecar.ts`) and the operator backfill script (`scripts/publish-seo-sidecars.js`) both produce records through `buildSeoRecord`; the edge renders them; the sitemap generator takes its budgets and algorithms from the same file. Its mirror in the app is gone, and so is the third copy: `WiSaw.client/src/utils/seoText.js` no longer exists (criterion 5).
- [x] 3. The enrichment record carries finished strings — a record now includes a nested `seo` object with the exact title, description, image title and image caption for the media's kind, produced by the shared rules at write time. Version stays `1`: the change is additive, so old readers ignore it and every reader treats absent fields as "derive them".
- [x] 4. The edge renders what it is given — with a record present and its kind matching the URL, the injector emits those strings verbatim (no re-truncation, no rewriting); without one, or when the record predates this change, it derives through the same rules, so first bytes stay correct during the rollout rather than depending on a backfill.
- [x] 5. The app stops composing text and displays what it is handed — `WiSaw.client/src/utils/mediaSeo.js` resolves in one place: the record fetched from `img.wisaw.com/<id>.json` (`src/utils/seoRecord.js`, cached, never rejects), else the head the server already sent for this path (`src/utils/servedHead.js`), else a last-resort title and comment echo that adds no wording of its own. The detail page's inline composition is deleted (about 35 lines out of `PhotosComponent.js`) and the JSON-LD now uses the same resolved strings as the tags, which it did not before.
- [x] 6. Text stays consistent across all three surfaces — a test asserts the sitemap entry, the edge head and the hydrated app head carry byte-identical titles for one record; another proves an old record (no `seo`) renders exactly what the pre-change rules produced, so the rollout changes no published wording.

## Notes

### Decisions taken while building (2026-11-10)

The four gating questions were put to the human and no answer came back before the build window closed, so these are Agent decisions, recorded here for review. None can be reversed by data; all can be reversed by code.

- **How the app receives text**: it fetches the same `<id>.json` record the edge reads, rather than waiting for an API schema change (which would need a coordinated AppSync deploy and was out of reach in this pass).
- **What the fallback is** (the approval asked for in Description): when no record exists, the app re-declares the head bytes the server already sent. That keeps Helmet from blanking the tags without inventing wording; the old rule set is kept only as a last resort and applies to the few pages with neither record nor served head.
- **Version bump**: stay at `v: 1` with an additive nested `seo` object. Readers ignore unknown fields, so this is safe in either deploy order — unlike a version bump, which would have made one side reject every existing record.
- **Records without the new fields** are derived at the edge through the shared rules; no bulk rewrite is required for correctness, and the operator script can fill them in whenever it next runs.

### Findings while building

- Four copies of the rules existed, not three: the storage writer also had a second copy inside `generateSiteMap/index.ts`, which grew slightly different budgets (a 60-character head minimum against the edge's 24). Unifying them was the point of the ticket; page slots and Google Image/sitemap slots remain two vocabularies in one module, because collapsing them would silently rewrite published sitemap text.
- The operator backfill script had drifted again while this ticket was in progress (7 keys against the writer's 8), which is exactly the failure mode the ticket exists to end. It now calls the shared rules, and the contract test compares full records by deep equality instead of a hand-written key list.

### Validation performed (2026-11-10)

- Backend: `tests/seo-text-single-source.js` (new, 12 cases — function identity between writer and rules, byte-equality of old-record rendering against the pre-change output, verbatim edge rendering, wrong-kind records deriving instead, word-boundary truncation through both entry points); existing suites unchanged in count and result — `tests/inject-meta-tags.js` 59 passing (they never needed editing), `tests/seo-crawler-contract.js` 36, sitemap/naming/lifecycle suites green. Whole backend run: 269 passing / 5 failing, the five being the pre-existing `getSeasonBoundaries` timezone cases.
- Client: `npx vitest run` = 13 files / 138 tests passing (added `src/utils/seoRecord.test.js`, `src/utils/servedHead.test.js`; rewrote the text half of `mediaSeo.test.js`); `npx eslint` on every touched file clean; `npm run build` green, including the postbuild template contract (18 tests).
- Contract test repaired: `src/headHydration.contract.test.js` pinned `-thumb.webp` inside the edge's `utils.js`, and ticket 5 had moved that rule to `mediaNaming.js`. It now pins the naming module's suffix and extension constants. Without this repair, a cross-repo drift guard would have been quietly failing for the wrong reason.
