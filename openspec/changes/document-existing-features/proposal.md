## Why

WiSaw (What I Saw) is a location-aware photo and video sharing platform with no user accounts — only anonymous persistent identities. This change documents all existing system capabilities as formal specs so that future changes have a clear behavioral baseline to diff against.

## What Changes

- Documenting 15 existing capabilities as spec files (no code changes)
- Establishing the requirements foundation for all features currently in production

## Capabilities

### New Capabilities

- `photo-upload`: Generate presigned S3 upload URLs and create photo records with GPS coordinates, video flag, and abuse-check gate
- `photo-feed`: Multiple feed strategies — by-date/radius, watcher feed, recent, and full-text search — with optional Wave filtering and pagination
- `photo-watchers`: Subscribe/unsubscribe to photos to receive notifications; watch count maintained on the Photo record
- `photo-recognitions`: AWS Rekognition labels, moderation labels, and text detection run automatically on upload; stored as JSON metadata on Photo
- `image-processing`: Server-side pipeline triggered by S3 upload events — generates WebP thumbnail + full WebP, extracts dimensions, runs Rekognition, then activates the photo record
- `comments`: Create and delete comments on photos; photo record keeps a live commentsCount and lastComment snapshot; all watchers are notified on new comments
- `abuse-reports`: Users can report photos; reports older than 7 days are purged automatically; users with more than 3 reports against their photos are banned from uploading
- `contact-forms`: Authenticated-by-UUID free-text contact/feedback submissions
- `user-identity`: Passwordless persistent identity via nickName + hashed secret; UUID is the stable device identifier; nickName must be globally unique
- `friendships`: Pending friendship system — initiator creates a one-sided record; recipient accepts to finalise; each confirmed friendship has a dedicated Chat
- `chat-messages`: Real-time direct messaging over GraphQL subscriptions; upsert pattern supports optimistic-UI via `pending` flag; per-chat unread counts with reset
- `waves`: Named content channels with optional geo-location and radius; creator is auto-joined; photos can be added/removed; all feed queries accept an optional `waveUuid` filter
- `photo-locations`: Cluster a user's own photos by geographic proximity using DBSCAN; returns centroid, photo count, and date range per cluster
- `seo`: Lambda@Edge functions inject Open Graph meta tags for photo/video share links; redirect www → apex; redirect legacy integer IDs to UUID-format URLs
- `site-map`: Scheduled Lambda generates and uploads an XML sitemap of all active photos and videos to S3 for search engine indexing

### Modified Capabilities

_(none — this is initial documentation of existing features)_

## Impact

- graphql/schema.graphql — authoritative source for all query/mutation/subscription contracts documented here
- lambda-fns/controllers/ — implementation of all GraphQL resolvers
- lambda-fns/lambdas/ — event-driven Lambda functions (S3 triggers, CloudFront Lambda@Edge, scheduled)
- lib/resources/ — CDK infrastructure definitions (AppSync, CloudFront, S3, RDS)
- migrations/ — PostgreSQL schema (PostGIS enabled) backing all features
