---
tracker_id: ""
id: 3
type: "story"
title: "Titles carry the AI tags, captions and descriptions carry the comments"
parent: seo-indexing
covers: []
sources: []
companions: []
after: [2]
assignee: ""
refined: true
hitl: false
risk: medium
status: built
---

# Titles carry the AI tags, captions and descriptions carry the comments

## Description

Every place WiSaw tells a crawler about a photo now says one thing twice: the sitemap's image title and caption are both assembled from the same text, and a page with both AI tags and a comment gets a `<title>` and a meta description that lead with the same sentence. Splitting them gives each slot its own answer — the tags say what is in the picture, the newest comment says what people say about it — so 21k pages carry two distinct texts instead of one repeated text.

This continues the decision made on 2026-11-07 for `og:image:title` and `og:image:caption`: tags title, comments caption. It extends that rule to the sitemap image and video entries and to the page title against the meta description, so every surface follows one rule a builder can state in a sentence.

## Requirements

1. **Sitemap image entry splits its two texts**
   **Given** a photo with AI tags and at least one comment
   **When** the sitemap is generated
   **Then** its image title is built from the tags and its image caption is the newest comment
   **And** the two texts are not equal
   **And** the title stays within 100 characters and the caption within 512

2. **Sitemap entry with no comment keeps one text**
   **Given** a photo with AI tags and no comment
   **When** the sitemap is generated
   **Then** its image title and caption are the same tag-derived text, because there is nothing to caption

3. **Sitemap title survives having no tags**
   **Given** a photo with a comment but no AI tags
   **When** the sitemap is generated
   **Then** its image title is built from the place and capture month, or from the photo's identity when neither is known
   **And** the title does not repeat the comment

4. **Video entries follow the same split**
   **Given** a video with AI tags or a comment
   **When** the sitemap is generated
   **Then** its video title follows the title rule and its video description follows the caption rule, under the same limits as photos

5. **Page title and meta description differ when both sources exist**
   **Given** a photo whose SEO sidecar carries both AI tags and a comment
   **When** the edge injector builds the page's head
   **Then** the page title keeps its current head — the comment, with place and capture month behind it — while the meta description leads with the tag list instead of repeating that sentence
   **And** the title and the description are not equal, and each keeps its own length budget

6. **Single-source pages keep today's text**
   **Given** a photo with only a comment, only tags, or neither
   **When** the edge injector builds the page's head
   **Then** the title falls back from the comment to the tags, then to an identity-bearing title that keeps the page unique among 21k pages
   **And** the description falls back to the comment when there are no tags, and to place, month and brand when there is neither

## Boundaries

- Touch point: sitemap photo and video entries — what is used there: their title and caption text; owner: this story
- Touch point: edge injector's page title and meta description — what is used there: lead text selection; owner: this story
- Must not change: the SEO sidecar's fields, key shape, writers or refresh triggers — nothing new needs to reach the edge for this rule
- Must not change: `og:image:title` from tags and `og:image:caption` from comments, including omitting the caption when nobody has commented
- Must not change: canonical spelling, redirects, and every byte-exact HTML rewrite the crawler contract tests hold, which is what kept 22k pages indexed
- Must not change: photo soft-delete, sidecar cleanup on delete, and the upload-time sidecar write

## References

- parent — `_bmad-output/seo-indexing/tickets/tickets.toml`
- decision — `_bmad-output/seo-indexing/.memlog.md`, 2026-11-07 sidecar lifecycle decision, point on `og:image:title` versus `og:image:caption`
- research — `_bmad-output/seo-indexing/research-seo-edge-injection-and-sidecar-lifecycle/research-seo-edge-injection-and-sidecar-lifecycle.md`, edge injection and sidecar lifecycle

## Notes

- Decision: 2026-11-09, settled by the builder at the user's request ("make a suggestion what makes more sense for which"), to confirm on review. The tag list goes in `image:title` / `og:image:title` (already shipped) and the newest comment in `image:caption` / `og:image:caption` (already shipped); for the document pair the page title keeps its prose head — the comment — and the meta description takes the tag list when both exist. Reasoning: an image title labels the picture, where tags read well and a truncated comment does not; a document title is a headline people click, and comments are the only per-photo unique text WiSaw has, while repeated tag lists are what once made 21k pages look near-identical. Rejected alternative: tags in the page title too — one uniform rule, but it turns ~60-character headlines into comma lists and hands the strongest ranking signal to unmoderated comments on the reverse mapping.
- Risk medium: this text is what Google shows for ~21k indexed pages; a wrong rule costs ranking on the site's only growth channel, but the change is content-only, covered by tests, and reversible by redeploy.
- Waits on seo-indexing/2 because: its criteria and Boundaries describe the sidecar shape, root keys and `og:image:*` split that ticket 1 and 2 left behind; building on an earlier tree would collide with files still in review.
- Operator step after build (not part of criteria): deploy the sitemap generator and publish the edge function in prod, then fetch `https://wisaw.com/sitemap.xml` and one commented photo page to confirm two distinct texts appear live.
- Note: a page whose only text is the tags keeps a title and description that resemble each other — accepted, since the user's rule separates them only when both a comment and tags exist.
