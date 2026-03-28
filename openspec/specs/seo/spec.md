## ADDED Requirements

### Requirement: Inject Open Graph meta tags for photo share links
The system SHALL intercept CloudFront requests to `/photos/<id>` URLs and inject Open Graph and Twitter Card meta tags into the HTML response so shared links render rich previews in social media and messaging apps.

#### Scenario: Photo URL receives enriched HTML
- **WHEN** a CloudFront request arrives at a `/photos/<photoId>` path
- **THEN** the `injectMetaTagsLambdaFunction` Lambda@Edge fetches `index.html` from the origin S3 bucket, injects OG tags (title, description, `og:image` pointing to the CDN thumbnail URL), and returns the enriched HTML with status 200

#### Scenario: Video URL receives enriched HTML
- **WHEN** a CloudFront request arrives at a `/videos/<videoId>` path
- **THEN** the Lambda@Edge injects OG tags appropriate for video content (including `og:video` metadata) and returns the enriched HTML

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
The system SHALL permanently redirect `/photos/<malformed-uuid>` and `/videos/<malformed-uuid>` URLs to their correctly zero-padded UUID equivalents, where a malformed UUID matches the pattern `00000000-0000-0000-0000-{1 to 11 digits}`.

#### Scenario: Malformed UUID photo URL is redirected
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-29864`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/photos/00000000-0000-0000-0000-000000029864`

#### Scenario: Malformed UUID video URL is redirected
- **WHEN** a CloudFront request arrives at `/videos/00000000-0000-0000-0000-12345`
- **THEN** the `redirectLambdaEdgeFunction` SHALL return a 301 redirect to `/videos/00000000-0000-0000-0000-000000012345`

#### Scenario: Correctly-formatted UUID passes through
- **WHEN** a CloudFront request arrives at `/photos/00000000-0000-0000-0000-000000029864` (12-digit last segment)
- **THEN** the request SHALL pass through unchanged (not matched by this rule)

#### Scenario: Query string is preserved on redirect
- **WHEN** a malformed UUID URL includes a query string
- **THEN** the 301 redirect SHALL preserve the query string
