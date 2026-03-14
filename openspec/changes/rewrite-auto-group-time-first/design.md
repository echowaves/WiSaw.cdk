## Context

Replace the current DBSCAN-based spatial clustering algorithm with a simpler time-first approach. The current implementation has grown to ~440 lines across multiple iterations and produces poor results (fragmented waves, absorb logic bugs). The new algorithm walks the timeline and creates wave boundaries at significant location changes.

## Goals / Non-Goals

**Goals:**
- Simpler, correct wave grouping with intuitive boundaries
- Locationless photos automatically included in nearby waves
- One geocode call per invocation, stays under AppSync 30s timeout
- Cap at 1000 photos per wave

**Non-Goals:**
- Changing the GraphQL mutation signature (`autoGroupPhotosIntoWaves(uuid)`)
- Modifying other wave operations (listWaves, createWave, etc.)
- Client-side changes (separate repo)

## Design

### Algorithm

```
main(uuid):
  1. Query up to 1000 oldest ungrouped photos (all, with or without location)
     sorted by createdAt ASC
  
  2. If none → return { photosGrouped: 0, photosRemaining: 0, hasMore: false }
  
  3. Find anchor = first photo in the list that has a location
  
  4. If no anchor found (all locationless):
     → Create "Uncategorized, DateRange" wave with all fetched photos
     → Return result
  
  5. Walk through photos in order:
     For each photo:
       - No location → INCLUDE
       - Within 50km of anchor → INCLUDE
       - >50km from anchor → STOP (this photo is NOT included)
  
  6. Reverse geocode anchor location → locationName
     - If geocode fails → locationName = "Uncategorized"
  
  7. Format wave name: "{locationName}, {dateRange}"
     - dateRange from earliest to latest photo in the collected set
  
  8. createWaveAndAssign(waveName, uuid, photoIds, anchorLon, anchorLat)
  
  9. Count remaining ungrouped → return result
```

### Distance Calculation

Use PostGIS `ST_DistanceSphere` for accurate distance or compute Haversine in JS. Since we already have lat/lon as floats, a JS Haversine function avoids extra DB queries. The 50km threshold is approximate, so Haversine is sufficient.

### Functions

**Keep:**
- `reverseGeocode(lat, lon)` — unchanged
- `formatDateRange(earliest, latest)` — unchanged
- `createWaveAndAssign(name, uuid, photoIds, lon, lat)` — unchanged

**Add:**
- `haversineDistance(lat1, lon1, lat2, lon2)` — returns distance in km

**Remove:**
- `splitByTemporalGaps` — no longer needed
- `buildTemporalCluster` — no longer needed
- `assignPhotosToNearestWave` — no absorb logic
- `countRemainingUngrouped` — replace with inline count from the query

**Remove interfaces:**
- `ClusteredPhoto` — replace with simpler `Photo { id, lat?, lon?, createdAt }`
- `TemporalCluster` — no longer needed

### Return Contract

Every call either:
- Creates exactly one new wave → `{ waveUuid, name, photosGrouped, photosRemaining, hasMore: true/false }`
- Has nothing to process → `{ waveUuid: null, name: null, photosGrouped: 0, photosRemaining: 0, hasMore: false }`

No absorb paths. No ambiguity. Client always appends when `photosGrouped > 0`.
