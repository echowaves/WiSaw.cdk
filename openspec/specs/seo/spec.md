## ADDED Requirements

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

---

### Requirement: Redirect www to apex domain
The system SHALL permanently redirect requests from `www.wisaw.com` to `wisaw.com`, preserving the request path and query string.

#### Scenario: www redirect issued
- **WHEN** a CloudFront request has `Host: www.wisaw.com`
- **THEN** the `redirectLambdaEdgeFunction` returns a 301 redirect to the same path on `https://wisaw.com`

---

### Requirement: Redirect legacy integer photo/video IDs to UUID format
The system SHALL permanently redirect `/photos/<integer>` and `/videos/<integer>` URLs to their UUID-format equivalents.

#### Scenario: Integer photo ID redirected
- **WHEN** a request is made to `/photos/<integer>` or `/videos/<integer>`
- **THEN** the Lambda@Edge converts the integer to a zero-padded UUID (`00000000-0000-0000-0000-<12-digit-padded-id>`) and returns a 301 redirect to the UUID path

#### Scenario: Non-integer IDs are passed through
- **WHEN** the request URI does not match the integer ID pattern
- **THEN** the request is passed through to the origin unchanged (after the www-redirect check)

---

### Requirement: Image CDN redirect
The system SHALL redirect image requests via `imgRedirectLambdaEdgeFunction` to the correct S3/CDN origin.

#### Scenario: Image request redirected to CDN
- **WHEN** a CloudFront distribution backed by the img-redirect Lambda receives an image request
- **THEN** the Lambda evaluates the request and redirects or forwards it to the appropriate image URL on the CDN

---

### Requirement: Redirect malformed UUID photo/video URLs to correctly-padded equivalents
The system SHALL permanently redirect `/photos/<malformed-id>` and `/videos/<malformed-id>` URLs to their correctly formatted UUID equivalents, where a malformed ID is any string composed entirely of zeros (`0`) and dashes (`-`) followed by a trailing integer. The system SHALL extract the trailing integer, convert it to a properly zero-padded UUID, and issue a 301 redirect. If the reconstructed UUID is identical to the original ID, the request SHALL pass through unchanged to prevent infinite redirects.

#### Scenario: Short-padded UUID is redirected
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-29864`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/photos/00000000-0000-0000-0000-000000029864`

#### Scenario: Extra-dash malformed ID is redirected
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-0000000-29864`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/photos/00000000-0000-0000-0000-000000029864`

#### Scenario: Arbitrary zeros-and-dashes prefix is redirected
- **WHEN** a CloudFront request arrives at `/videos/0-0-0-0-12345`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/videos/00000000-0000-0000-0000-000000012345`

#### Scenario: Correctly-formatted UUID passes through without redirect loop
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-000000029864` (valid 36-char UUID)
- **THEN** the reconstructed UUID SHALL match the original ID and the request SHALL pass through unchanged

#### Scenario: UUID containing hex letters passes through
- **WHEN** a CloudFront request arrives at `/photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **THEN** the request SHALL pass through unchanged (hex letters are not stripped)

#### Scenario: Query string is preserved on redirect
- **WHEN** a malformed ID URL includes a query string
- **THEN** the 301 redirect SHALL preserve the query string
