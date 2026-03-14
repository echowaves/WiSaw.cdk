## 1. Add AWS SDK dependency

- [ ] 1.1 Add `@aws-sdk/client-geo-places` to `package.json` dependencies with exact version `3.1003.0`
- [ ] 1.2 Run `npm install`

## 2. CDK infrastructure

- [ ] 2.1 Add IAM policy to `wisawFn` Lambda granting `geo-places:ReverseGeocode` permission in `lib/wi_saw.cdk-stack.ts`

## 3. Replace reverseGeocode implementation

- [ ] 3.1 Replace the Nominatim HTTP-based `reverseGeocode` function in `autoGroupPhotosIntoWaves.ts` with AWS Location Service `ReverseGeocodeCommand` from `@aws-sdk/client-geo-places`
- [ ] 3.2 Remove the `https` import (no longer needed)

## 4. Add formatCoordinates helper and fix naming

- [ ] 4.1 Add `formatCoordinates(lat, lon)` function that returns `"40.7°N, 74.0°W"` format with 1 decimal place and compass suffixes
- [ ] 4.2 Change the all-locationless wave name from `Uncategorized, ${dateRange}` to just `${dateRange}`
- [ ] 4.3 Change the geocode-failure fallback from `Uncategorized, ${dateRange}` to `${formatCoordinates(lat, lon)}, ${dateRange}`
