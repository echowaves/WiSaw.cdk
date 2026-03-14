## 1. Force English in Reverse Geocoding

- [ ] 1.1 Add `accept-language=en` parameter to the Nominatim reverse geocoding URL in `reverseGeocode()` in `lambda-fns/controllers/waves/autoGroupPhotosIntoWaves.ts`

## 2. Handle Geocoding Failures as Unresolvable

- [ ] 2.1 When `reverseGeocode()` returns null for a spatial cluster, skip wave creation for that cluster and collect its photos as "unresolvable" (same pool as locationless photos)
- [ ] 2.2 Remove the `formatCoordinateName()` coordinate-based fallback function (no longer used)

## 3. Include All Ungrouped Photos in Remaining Count

- [ ] 3.1 Update the `photosRemaining` count query in `autoGroupPhotosIntoWaves.ts` to remove the `location IS NOT NULL` filter, so all ungrouped photos are counted (locationless + geocoding-failed)

## 4. Assign Unresolvable Photos to Nearest Wave in Time

- [ ] 4.1 After spatial clustering, when no more geocodable clusters remain, query all unresolvable ungrouped photos for the user (locationless + those from geocoding-failed clusters)
- [ ] 4.2 Query all existing waves for the user with their earliest and latest photo dates to compute each wave's date-range midpoint
- [ ] 4.3 For each unresolvable photo, calculate time distance to each wave's midpoint and assign the photo to the nearest wave via `WavePhotos` insert
- [ ] 4.4 Return the count of assigned unresolvable photos in `photosGrouped` with `hasMore: false`

## 5. Create Catch-All Wave for Unresolvable Photos When No Waves Exist

- [ ] 5.1 When no geocodable clusters remain and no waves exist for the user, collect all unresolvable ungrouped photos and apply temporal splitting (30-day gap logic)
- [ ] 5.2 Create catch-all waves named `"Uncategorized, <DateRange>"` with `location` set to NULL for each temporal cluster
- [ ] 5.3 Assign unresolvable photos to their respective catch-all waves via `WavePhotos` inserts

## 6. Verification

- [ ] 6.1 Test that newly created waves use English place names for non-English regions
- [ ] 6.2 Test that geocoding-failed cluster photos are deferred and assigned to nearest wave in time
- [ ] 6.3 Test that locationless photos are assigned to the temporally nearest wave when spatial clustering is complete
- [ ] 6.4 Test that unresolvable-only users get catch-all "Uncategorized" waves with correct temporal splitting
- [ ] 6.5 Test that `photosRemaining` includes all ungrouped photos and `hasMore` correctly reflects remaining work
