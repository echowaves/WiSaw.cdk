---
id: 8
type: "story"
title: "Real video duration never reaches a page or its structured data"
parent: seo-indexing
covers: []
after: [4]
assignee: ""
refined: false
hitl: false
risk: medium
severity: P3
---

# Real video duration never reaches a page or its structured data

## Notes

Risk rationale: medium — it adds a field to the API and to a table that already holds rows, so a bad migration could break metadata reads for existing media; nothing is deleted.

Raised while resolving ticket 4. The fabricated duration there was replaced by removing it rather than fixing it, because no real value can reach the page today: the fact exists only as upload-time object metadata that one edge path reads and then discards into a log line, and the stored sidecar has no place for it. Every consumer that wants a duration — video rich results, the sitemap's duration field, a player's advertised length — either omits it or invents one.

## Description

As someone trying to surface this site's videos in search results, I want each video page to state how long the video actually is, so the page can qualify for video rich results and so nothing on the page has to guess.

**Acceptance criteria:**
- [ ] When a video's metadata is recorded, its real duration is stored alongside the other facts about it.
- [ ] When a client asks for a media item, the response carries that duration.
- [ ] A video page states the real duration in the tags and structured data that use it, and omits the tag rather than guessing when the duration is unknown.
- [ ] Media recorded before this change does not lose or corrupt any existing metadata, and shows no duration rather than a wrong one until it has one.

**Definition of done:**
- [ ] The behavior above is demonstrated by tests at each layer that changes.
- [ ] Existing media rows are accounted for: the migration path is stated with its evidence, not assumed.

## Boundaries

Do not change: how any other metadata field is stored or served; anything under `lib/`.
May change: the sidecar's storage shape and writer, the API's media response, the code that reads duration at request time so it feeds the stored value instead of a log line, and the app's tags.
Revisit if: the migration turns out to need a backfill over existing rows — then bring a sizing estimate before proceeding.

## Tasks

- [ ] 1. Confirm where the real duration is available at write time, and what happens to media that predates the field.
- [ ] 2. Add the field through storage, API and app in that order, testing each layer as it lands.
- [ ] 3. Point the consumers that currently guess or omit a duration at the real value.

## References

- Ticket 4 and its plan record why the fabricated values were removed rather than corrected: `_bmad-output/seo-indexing/tickets/bug-edge-head-tags-rewritten-by-spa-plan.md`.
- The validation report traces where duration is read, logged and dropped.
