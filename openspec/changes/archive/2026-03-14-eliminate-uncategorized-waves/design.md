## Context

The `autoGroupPhotosIntoWaves.ts` Lambda function groups ungrouped photos into waves. It currently uses Nominatim (OpenStreetMap's free geocoding API) for reverse geocoding. Most waves end up "Uncategorized" because:

1. **Rate limiting**: Nominatim allows 1 req/s. The client calls auto-group in a loop, causing subsequent requests to be throttled/rejected. All errors silently resolve to `null`.
2. **Narrow field matching**: Only 5 address fields are checked (`city`, `town`, `village`, `county`, `state`). Many locations only have other fields like `hamlet`, `suburb`, `municipality`, `country`.

The `wisawFn` Lambda already receives environment variables via `{...config}` spread and has 10GB memory / 30s timeout. CDK uses `aws-cdk-lib` v2.241.0. AWS SDK clients at v3.1003.0 are already used for S3, Rekognition, Lambda, STS, and SSO-OIDC.

## Goals / Non-Goals

**Goals:**
- Replace Nominatim with AWS Location Service for reliable, rate-limit-free reverse geocoding
- Eliminate all "Uncategorized" wave names
- Add coordinate-based fallback for when geocoding truly fails (network error, etc.)
- Add date-only naming for locationless photo batches

**Non-Goals:**
- Changing the wave grouping algorithm itself
- Renaming existing "Uncategorized" waves in the database
- Adding geocoding retry/queue logic

## Decisions

### 1. Use `@aws-sdk/client-geo-places` with `ReverseGeocode` API
Use the newer `@aws-sdk/client-geo-places` SDK (not the older `client-location`) with the `ReverseGeocodeCommand`. This is the current recommended API for reverse geocoding with AWS Location Service and does not require creating a Place Index resource — it uses the AWS-managed data directly.

**Rationale**: The `client-geo-places` SDK uses the standalone Geo Places API which doesn't need a Place Index CDK resource. This simplifies infrastructure changes to just IAM permissions. No rate limiting from Lambda since it's an AWS-to-AWS call in the same region.

**Alternative considered**: Nominatim with wider field fallback — still subject to rate limiting, which is the primary cause of "Uncategorized" waves.

### 2. CDK changes: IAM policy only
Grant the `wisawFn` Lambda an IAM policy for `geo-places:ReverseGeocode`. No Place Index resource needed with the standalone API.

**Rationale**: Minimal infrastructure change. The standalone Geo Places API is fully managed by AWS.

### 3. Coordinate-based fallback when AWS geocoding fails
If `ReverseGeocode` throws an error or returns no results, format coordinates as `"40.7°N, 74.0°W"` (1 decimal place, compass suffixes).

**Rationale**: Network errors or edge-case coordinates (middle of ocean) may still fail. Coordinates are always available when the anchor has location data.

### 4. Date-only name for all-locationless photos
When all photos lack GPS, use just the date range (e.g., `"Mar 2024"`) without any prefix.

### 5. Extract location name from AWS response
Use the `ResultItems[0].Title` field from `ReverseGeocodeResponse`, which contains human-readable place names (e.g., "Springfield, Illinois"). If Title is too long or verbose, fall back to locality/municipality from the address components.

## Risks / Trade-offs

- [AWS Location Service cost] → $0.04/1000 requests. For typical usage (hundreds/month), cost is negligible ($0).
- [New dependency `@aws-sdk/client-geo-places`] → Consistent with existing AWS SDK client pattern. Must pin exact version (3.1003.0 to match others).
- [IAM policy needed] → Small CDK change, no new resources to manage.
- [Existing "Uncategorized" waves unchanged] → Not worth a migration for a cosmetic label.
