## Context

The `injectMetaTagsLambdaFunction` Lambda@Edge intercepts CloudFront requests to `/photos/*` and `/videos/*`. It fetches the SPA's `index.html` from the `wisaw.com` S3 bucket and injects Open Graph / Twitter Card meta tags for the specific photo or video. However, the base `index.html` already contains its own set of OG/Twitter tags (pointing to the site logo and generic descriptions). The current `injectMetaTags` function in `utils.js` only appends new tags after `</title>` without removing the originals, resulting in duplicate tags.

## Goals / Non-Goals

**Goals:**
- Ensure shared photo/video URLs contain exactly one set of OG/Twitter meta tags pointing to the actual content
- Fix the double-image preview in iMessage/SMS sharing

**Non-Goals:**
- Changing the base `index.html` in the frontend repo — the homepage still needs its own OG tags
- Modifying the tag injection approach (the `</title>` insertion pattern works fine)
- Adding new meta tags beyond what's already injected

## Decisions

### Strip duplicate meta tags via regex in `injectMetaTags`

**Decision**: Add regex-based removal of existing OG/Twitter meta tags from the base HTML before injecting content-specific tags.

**Rationale**: The `injectMetaTags` function already manipulates the HTML string (title replacement, canonical link replacement). Adding tag stripping here is consistent with the existing pattern and keeps the fix in a single location.

**Alternative considered**: Remove OG tags from the base `index.html` in the frontend repo. Rejected because the homepage itself needs those tags for when users share `wisaw.com` directly (which doesn't go through Lambda@Edge).

**Tags to strip**:
- `<meta property="og:image" ...>`
- `<meta property="og:title" ...>`
- `<meta property="og:url" ...>`
- `<meta property="og:type" ...>`
- `<meta property="og:description" ...>` (the combined `name="description" property="og:description"` tag)
- `<meta name="twitter:card" ...>`
- `<meta name="twitter:title" ...>`
- `<meta name="twitter:image" ...>`
- `<meta name="twitter:description" ...>`

**Tags to preserve** (not duplicated by injection):
- `<meta property="og:site_name" ...>`
- `<meta property="og:locale" ...>`
- `<meta name="robots" ...>`
- `<link rel="apple-touch-icon" ...>`, favicons, manifest

## Risks / Trade-offs

- **[Risk] Regex fragility if `index.html` format changes** → The HTML is controlled (Vite build output), and the regex patterns are simple single-line meta tag matches. The existing canonical link replacement already uses the same approach. Low risk.
- **[Risk] Stripping too aggressively** → The regex targets specific `property=` and `name=` values, not all meta tags. The `og:site_name` and `og:locale` tags are preserved since they apply to all pages.
- **[Trade-off] No migration needed** → This is a Lambda@Edge code change only. Deploying via CDK will update the CloudFront distribution. There may be a brief propagation delay but no data migration or breaking changes.
