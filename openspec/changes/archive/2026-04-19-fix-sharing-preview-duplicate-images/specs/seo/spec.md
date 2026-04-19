## MODIFIED Requirements

### Requirement: Inject Open Graph meta tags for photo share links
The system SHALL intercept CloudFront requests to `/photos/<id>` URLs and inject Open Graph and Twitter Card meta tags into the HTML response so shared links render rich previews in social media and messaging apps. The system SHALL strip any existing `og:image`, `og:title`, `og:url`, `og:type`, `og:description`, `twitter:card`, `twitter:title`, `twitter:image`, and `twitter:description` meta tags from the base HTML before injecting content-specific tags, to ensure only one set of OG/Twitter tags exists in the response.

#### Scenario: Photo URL receives enriched HTML with no duplicate tags
- **WHEN** a CloudFront request arrives at a `/photos/<photoId>` path
- **THEN** the `injectMetaTagsLambdaFunction` Lambda@Edge fetches `index.html` from the origin S3 bucket, strips existing OG and Twitter Card meta tags from the base HTML, injects content-specific OG tags (title, description, `og:image` pointing to the CDN thumbnail URL), and returns the enriched HTML with status 200 containing exactly one `og:image` tag

#### Scenario: Video URL receives enriched HTML with no duplicate tags
- **WHEN** a CloudFront request arrives at a `/videos/<videoId>` path
- **THEN** the Lambda@Edge strips existing OG and Twitter Card meta tags from the base HTML, injects OG tags appropriate for video content (including `og:video` metadata), and returns the enriched HTML containing exactly one `og:image` tag

#### Scenario: Preserved non-duplicate meta tags
- **WHEN** the Lambda@Edge processes a photo or video URL
- **THEN** the `og:site_name`, `og:locale`, `robots`, favicon, manifest, and `apple-touch-icon` tags from the base HTML SHALL be preserved
