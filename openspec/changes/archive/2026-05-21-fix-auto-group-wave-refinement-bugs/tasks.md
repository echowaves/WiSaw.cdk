## 1. Track most-frequent locality during wave processing

- [x] 1.1 Add `localityCounts: Record<string, number>` map alongside existing variables (`currentWaveUuid`, `waveEarliest`, etc.)
- [x] 1.2 In the photo processing loop (line 271), increment count for each photo's locality when it fits in the current wave
- [x] 1.3 Add helper function `getMostFrequentLocality(localityCounts: Record<string, number>): string | null` that returns the key with highest count

## 2. Refine wave name based on most-frequent locality

- [x] 2.1 In the refinement block (line 349), replace `computeWaveNameFromKey(photoGeo, gl)` with a call using the most frequent locality from `localityCounts`
- [x] 2.2 When updating anchor fields during refinement, use the most-frequent locality's geocode data (district, region, country) — store these in parallel maps alongside `localityCounts`

## 3. Update and persist anchor fields during refinement

- [x] 3.1 Extend the UPDATE query at line 364 to include: `name`, `anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`
- [x] 3.2 Pass refined values (from most-frequent locality) to the UPDATE query

## 4. Persist wave name in DB

- [x] 4.1 Add `"name" = $X` column to the UPDATE query at line 364 with the refined `currentWaveName` value
- [x] 4.2 Ensure `currentWaveName` is computed and assigned before the final UPDATE block (lines 363-376)

## 5. Fix photo count updates mid-processing

- [x] 5.1 Call `_updatePhotosCount(waveUuid)` immediately after each `INSERT INTO "WavePhotos"` in the else branch (line 334-338), not just at end of loop
- [x] 5.2 Add a spec requirement that wave photo count is updated after each photo assignment

## 6. Update spec requirements

- [x] 6.1 Add REQ-5a: "When auto-grouping, wave name uses the most frequently occurring locality across all photos in the wave"
- [x] 6.2 Add REQ-8b: "Anchor fields (anchorLocality, anchorDistrict, etc.) are updated when a more common locality appears during photo processing"
- [x] 6.3 Update REQ-5 to clarify that wave name is persisted to DB after each refinement cycle
