## Why

Most auto-created waves are named "Uncategorized" due to two compounding issues: (1) the `reverseGeocode` function uses Nominatim's free API which rate-limits at 1 request/second — when the client calls auto-group in a loop, subsequent requests are throttled and silently fail, and (2) the function only checks 5 Nominatim address fields (`city`, `town`, `village`, `county`, `state`), discarding valid responses that only contain other fields. Both failure paths resolve to `null`, producing "Uncategorized" wave names. Switching to AWS Location Service eliminates rate-limiting from Lambda and provides reliable geocoding.

## What Changes

- Replace Nominatim reverse geocoding with AWS Location Service (`@aws-sdk/client-geo-places`)
- Add AWS Location Service Place Index CDK resource and grant the Lambda function permission to use it
- Add `@aws-sdk/client-geo-places` dependency to `package.json`
- Pass the Place Index name as an environment variable to the Lambda
- Add a coordinate-based fallback name (e.g., `"40.7°N, 74.0°W"`) when geocoding fails entirely
- Use date-only naming when all photos lack GPS coordinates
- Remove all "Uncategorized" string literals from wave naming logic

## Capabilities

### New Capabilities
- `aws-location-geocoding`: Replace Nominatim with AWS Location Service for reverse geocoding, add CDK infrastructure, and provide fallback naming for edge cases

### Modified Capabilities

## Impact

- `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`: Replace `reverseGeocode` implementation, update wave naming logic
- `lib/wi_saw.cdk-stack.ts`: Grant Lambda geo:SearchPlaceIndexForPosition permissions
- `lib/resources/lambdas.ts` or CDK stack: Add Place Index resource, pass env var
- `package.json`: Add `@aws-sdk/client-geo-places` dependency (exact version)
- No GraphQL schema changes, no database changes
