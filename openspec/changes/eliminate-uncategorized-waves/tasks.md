## 1. Add AWS SDK dependency

- [x] 1.1 Add `@aws-sdk/client-geo-places` to `package.json` dependencies with exact version `3.1003.0`
- [x] 1.2 Run `npm install`

## 2. CDK infrastructure

- [x] 2.1 Add IAM policy to `wisawFn` Lambda granting `geo-places:ReverseGeocode` permission in `lib/wi_saw.cdk-stack.ts`

## 3. Replace reverseGeocode implementation

- [x] 3.1 Replace the Nominatim HTTP-based `reverseGeocode` function in `autoGroupPhotosIntoWaves.ts` with AWS Location Service `ReverseGeocodeCommand` from `@aws-sdk/client-geo-places`
- [x] 3.2 Remove the `https` import (no longer needed)

## 4. Add formatCoordinates helper and fix naming

- [x] 4.1 Add `formatCoordinates(lat, lon)` function that returns `"40.7°N, 74.0°W"` format with 1 decimal place and compass suffixes
- [x] 4.2 Change the all-locationless wave name from `Uncategorized, ${dateRange}` to just `${dateRange}`
- [x] 4.3 Change the geocode-failure fallback from `Uncategorized, ${dateRange}` to `${formatCoordinates(lat, lon)}, ${dateRange}`
