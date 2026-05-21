## 1. Haversine Distance Utility

- [x] 1.1 Add `haversineKm(lat1, lon1, lat2, lon2)` function to `_autoGroupGeo.ts` — pure function returning distance in km between two coordinate pairs
- [x] 1.2 Define distance threshold map: `{ DISTRICT: 15, CITY: 50, REGION: 300, COUNTRY: 2000 }`

## 2. Spatial Distance Fallback in fitsPhotoInWave

- [x] 2.1 Extend `fitsPhotoInWave` to accept wave anchor coordinates (`anchorLat`, `anchorLon`) and photo coordinates (`lat`, `lon`)
- [x] 2.2 Add distance fallback logic: when string matching returns false, check if both photo and anchor have valid coordinates and distance ≤ threshold for the grouping level
- [x] 2.3 Update the `activeWave` object to carry `anchorLat`/`anchorLon` (extracted from the wave's location or from the first photo's coordinates)

## 3. Frequency Map Reset at Wave Boundary

- [x] 3.1 Clear `localityCounts`, `districtCounts`, `regionCounts`, `countryCounts`, `districtMap`, `regionMap`, `countryMap` when creating a new wave in the main loop

## 4. Batch Processing

- [x] 4.1 Add `LIMIT 200` to the ungrouped photos query
- [x] 4.2 After processing the batch, run a COUNT query for remaining ungrouped photos
- [x] 4.3 Return actual `photosRemaining` count and `hasMore: photosRemaining > 0` instead of hardcoded values

## 5. Bulk INSERT for WavePhotos

- [x] 5.1 Accumulate photo IDs in an array while iterating instead of inserting per-photo
- [x] 5.2 Add a `flushWavePhotos(waveUuid, photoIds, uuid)` helper that does a single multi-row INSERT into `WavePhotos`
- [x] 5.3 Call flush at wave boundaries (when a new wave is created) and at the end of the loop
- [x] 5.4 Remove per-photo `_incrementPhotosCount` calls; use single `_updatePhotosCount` per wave after flush

## 6. Testing

- [x] 6.1 Add test for Haversine distance function with known coordinate pairs
- [x] 6.2 Add test for `fitsPhotoInWave` with string match path
- [x] 6.3 Add test for `fitsPhotoInWave` with distance fallback path (string mismatch, within threshold)
- [x] 6.4 Add test for `fitsPhotoInWave` with distance fallback path (string mismatch, beyond threshold)
- [x] 6.5 Add test for batch processing: verify `hasMore` and `photosRemaining` values
