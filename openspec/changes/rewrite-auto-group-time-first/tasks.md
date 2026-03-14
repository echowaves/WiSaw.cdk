## 1. Remove isNewWave from GraphQL schema

- [ ] 1.1 Remove `isNewWave: Boolean!` from `AutoGroupResult` in `graphql/schema.graphql`

## 2. Rewrite autoGroupPhotosIntoWaves.ts

- [ ] 2.1 Remove old code: `ClusteredPhoto`, `TemporalCluster` interfaces, `splitByTemporalGaps`, `buildTemporalCluster`, `assignPhotosToNearestWave`, `countRemainingUngrouped`, DBSCAN query, all absorb logic, `isNewWave` from `AutoGroupResult`
- [ ] 2.2 Add `haversineDistance(lat1, lon1, lat2, lon2)` function returning km
- [ ] 2.3 Implement new `main()`: query up to 1000 oldest ungrouped photos (with and without location) sorted by createdAt ASC; find anchor; walk forward collecting photos within 50km or locationless, stop at first >50km; geocode anchor; create wave; return result
- [ ] 2.4 Handle all-locationless edge case: create "Uncategorized, DateRange" wave

## 3. Verify

- [ ] 3.1 Every return path creates exactly one wave or returns photosGrouped: 0
- [ ] 3.2 No absorb logic, no DBSCAN, no temporal splitting remains
- [ ] 3.3 Codacy analysis clean
