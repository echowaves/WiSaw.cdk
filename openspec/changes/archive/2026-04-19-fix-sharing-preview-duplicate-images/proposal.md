## Why

When sharing a photo or video link via SMS/iMessage, the preview shows two images: the actual photo and the WiSaw logo (`android-chrome-512x512.png`). This happens because the `injectMetaTagsLambdaFunction` Lambda@Edge injects new `og:image` and `twitter:image` meta tags but never removes the originals already present in the base `index.html`. The resulting HTML contains duplicate OG/Twitter tags, and iMessage renders both images.

## What Changes

- Strip existing `og:image`, `og:title`, `og:url`, `og:type`, `og:description`, `twitter:card`, `twitter:title`, `twitter:image` meta tags from the base HTML before injecting photo/video-specific tags
- After the fix, shared photo/video URLs will contain only one set of OG/Twitter meta tags pointing to the actual content

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `seo`: The OG tag injection requirement needs to specify that existing OG/Twitter meta tags from the base HTML must be stripped before injecting content-specific tags, to prevent duplicate tags in the response.

## Impact

- `lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js` — the `injectMetaTags` function needs to strip existing meta tags before injection
- Lambda@Edge redeployment required (CloudFront distribution update)
- No API, database, or dependency changes
