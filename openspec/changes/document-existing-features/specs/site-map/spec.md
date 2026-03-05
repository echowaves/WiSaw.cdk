## ADDED Requirements

### Requirement: Generate and publish XML sitemap
The system SHALL periodically generate an XML sitemap containing all active photos and videos and upload it to S3 so search engines can discover all content.

#### Scenario: Sitemap includes static pages
- **WHEN** the `generateSiteMap` Lambda is triggered
- **THEN** the generated sitemap SHALL include entries for `/`, `/about`, `/contact`, and `/terms`

#### Scenario: Sitemap includes all active photos
- **WHEN** the sitemap is generated
- **THEN** a URL entry for `/photos/<photoId>` is included for every active (non-video) Photo record, up to 30,000 records

#### Scenario: Sitemap includes video entries with metadata
- **WHEN** the sitemap is generated and a Photo record has `video: true`
- **THEN** the sitemap entry is written under `/videos/<photoId>` and includes video-specific XML elements: `thumbnail_loc` (pointing to `https://img.wisaw.com/<id>-thumb.webp`), `title` prefixed with "(video)", `description`, and `content_loc` (pointing to `https://img.wisaw.com/<id>.mov`)

#### Scenario: Sitemap uploaded to S3
- **WHEN** the sitemap stream is finalised
- **THEN** the complete XML sitemap is uploaded to the designated S3 bucket so CloudFront can serve it at `/sitemap.xml`
