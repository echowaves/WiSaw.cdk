## 1. Strip duplicate meta tags

- [x] 1.1 Add a `stripExistingMetaTags` function to `lambda-fns/lambdas/injectMetaTagsLambdaFunction/utils.js` that removes existing `og:image`, `og:title`, `og:url`, `og:type`, `og:description`, `twitter:card`, `twitter:title`, `twitter:image`, and `twitter:description` meta tags from the HTML string
- [x] 1.2 Call `stripExistingMetaTags` on the base HTML at the start of `injectMetaTags` before any tag injection

## 2. Testing

- [x] 2.1 Add unit tests verifying that `injectMetaTags` produces HTML with exactly one `og:image` tag when the input HTML contains existing OG/Twitter tags
- [x] 2.2 Add unit tests verifying that non-duplicate tags (`og:site_name`, `og:locale`, favicons, `apple-touch-icon`) are preserved
- [x] 2.3 Verify fix against live HTML by curling a photo URL after deployment and confirming single `og:image` tag
