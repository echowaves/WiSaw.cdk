---
id: 4
type: "bug"
title: "The crawler head the edge writes is rewritten and duplicated by the browser render"
parent: seo-indexing
covers: []
after: [3]
assignee: ""
refined: true
hitl: false
risk: medium
severity: P2
status: built
---

# The crawler head the edge writes is rewritten and duplicated by the browser render

## Description

Every media page arrives with a head written by the edge for crawlers, and the app then rebuilds that head from scratch when it paints. The two disagree about title, description, share image, content type and social card, so what a JS-rendering crawler indexes is not what was served. Worse, some tags are never reconciled at all: the app can only manage tags it stamped itself, so template-supplied ones survive beside its own — every media page ends up with two site-name tags permanently, and video pages with two robot directives. The wanted outcome: the head a browser ends up holding is the head the crawler was served, apart from what the app legitimately learns later; no tag appears twice anywhere; and navigation between pages changes only the values that actually changed.

## Reproduction

1. Fetch one photo page and one video page with JavaScript disabled and save each head.
2. Open the same two URLs in a browser, wait for content to finish painting, dump the live head from each.
3. Compare the saved and dumped heads tag by tag; count site-name tags, locale tags and robot directives in each dump.
4. Keep a reference to one SEO tag node, navigate to another media page and back, then check whether that node is still in the document.

**Observed:** values differ between the two dumps for title, description, share image, content type and social card; a second site-name tag appears on both pages and a second robot directive on the video page; tags holding unchanged values are replaced rather than kept.
**Expected:** identical values, exactly one of each tag, unchanged tags left in place.

## Cause Hypothesis

The app's head manager selects only the tags carrying its own marker, so anything the template or the edge supplied is invisible to it — never updated, never removed — while the edge adds a site-name tag of its own on top of the template's. Because the two sides derive title, description and share image from separate rules that have drifted apart, nearly every tag fails the equality test at first paint and the whole SEO set is replaced. Content types were chosen independently on each side, so neither pair is valid Open Graph. The app also waits for media dimensions before rendering its head, leaving a window during navigation with no canonical or share-card tags.

## Acceptance Criteria

1. Given any photo or video page, when the cold-response head and the hydrated DOM head are compared, then title, meta description, canonical URL, `og:title`, `og:description`, `og:image` and `og:url` carry identical values — or: a remaining difference is deliberate and recorded in Notes with its reason.
2. Given any page on the site, when its head is read after hydration, then `og:site_name`, `og:locale` and the robot directive each appear exactly once — including video pages, where two robot directives appear today.
3. Given a photo page and a video page, then `og:type` holds a valid Open Graph type for that content, and the served value and the rendered value agree on one value per page type.
4. Given any media page, then exactly one `twitter:card` applies to it, and player-only companion tags are absent unless the card is a player card.
5. Given a media page, then duration and release date carry the real stored values or are absent; no invented default is emitted anywhere in the head.
6. Given a media page, when its structured data is read after hydration, then one graph describes the page, its fields agree with the rendered head and with the media actually shown, and any value that is unknown is omitted rather than defaulted.
7. Given navigation from a photo page to another media page and back, then the returned page shows its own values with nothing left over from the other page, and a tag whose value did not change is still the same document node.
8. Given the duplicate site-name and robot-directive condition found here, when the ticket's tests run against the unfixed code they fail for both a photo and a video page, and pass after the fix.
9. Or: comparing at least five live media pages across both media routes shows the served head already survives hydration unchanged — then no change is needed; attach the samples to Notes and close the ticket on that evidence.

## Boundaries

- The edge keeps serving a complete crawler head; nothing a JavaScript-less crawler receives may be reduced by this change.
- The client template keeps exactly one mount point, as pinned by its existing contract test.
- Cache policies, redirects, error responses and the GraphQL API stay as they are.
- Copy wording stays as it is unless two sides cannot agree on one value without a wording change; any such change is recorded in Notes.

## References

- parent — `_bmad-output/seo-indexing/tickets/tickets.toml`
- validation — `_bmad-output/seo-indexing/validation-seo-head-consistency.md`, "How the reconciliation actually works" and "Consistency matrix — media pages"
- tests — `tests/inject-meta-tags.js` and `tests/seo-crawler-contract.js`, served-head suites to extend
- tests — `src/seo.template.test.js` in WiSaw.client, template and injector contract pinned today
- decision — `_bmad-output/seo-indexing/.memlog.md`, 2026-11-07 sidecar lifecycle simplification, `og:image:title` versus `og:image:caption`

## Notes

- Risk medium: these tags are what search and social surfaces show for the site's indexed pages, but the change is head content only, covered by tests, and reversible by redeploy.
- Waits on seo-indexing/3 because: its title and caption split defines the text both sides must now produce identically; building earlier would collide with files still in review.
- Decision 2026-11-10 (User): the share image for a media page is the thumbnail the user sees, not the full-resolution original — matching what the app and the published sitemap already advertise.
- Decision 2026-11-10 (User): one Open Graph pair per page type — `photo` for photos, `video.other` for videos — on both sides.
- Open question: closing the window in which no canonical or share-card tags exist (media dimensions not yet known) is worth doing only if it does not delay paint — decide with the user when the ticket starts.
- Operator step after build (not part of criteria): redeploy the edge function, then compare one live photo page and one live video page cold against hydrated before closing.
