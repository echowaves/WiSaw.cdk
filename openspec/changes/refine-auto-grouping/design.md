## Context

The current auto-grouping system processes ungrouped photos in batch mode, creating at most one wave per invocation. Photos are grouped by matching geographic fields (locality, region, country) and assigned to that single wave. The system has no concept of an "active" wave or incremental photo assignment.

Users upload photos via `createPhoto`, which reverse geocodes the location and stores locality fields. Currently, `localityLevel` is stored on the Photo to track geocode granularity. Auto-grouping is invoked manually or automatically after upload, processing up to 1000 ungrouped photos at once.

The new model shifts to an active-wave paradigm where:
- Each user has exactly one "active" wave at a time
- Photos stay ungrouped until auto-group is invoked
- Auto-group walks ALL ungrouped photos chronologically, creating new waves as needed
- `groupingLevel` is stored on the Wave, not passed as `localityLevel` on Photo
- When groupingLevel changes or a photo drifts outside the active wave's scope, a new wave is created

## Goals / Non-Goals

**Goals:**
- Replace `localityLevel` on Photo with `groupingLevel` stored on Wave
- Implement active wave model with single active wave per user
- Process all ungrouped photos chronologically in one auto-group call
- Create new waves when groupingLevel changes or photo drifts outside active wave
- Store anchor fields on Wave for field-based photo comparison
- Add `isNewWave` flag to AutoGroupResult

**Non-Goals:**
- Merging waves (handled by existing wave-merge capability)
- Moving photos between waves (handled by existing wave-photo-auto-move)
- Distance-based grouping (field-matching only)
- Real-time wave assignment during photo upload (batch via auto-group only)
- Multiple active waves per user

## Decisions

### Decision 1: Active Wave Model with Anchor Fields

**Choice**: Each user has exactly one active wave (`isActive=true`). When a new wave is created, the old one becomes inactive (`isActive=false`). The Wave stores anchor fields (`anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`) from the first photo that defined the wave.

```
┌─────────────────────────────────────────────────────────────┐
│ Wave Record                                                  │
├─────────────────────────────────────────────────────────────┤
│ waveUuid: xxx                                                │
│ groupingLevel: CITY                                          │
│ anchorLocality: "Manhattan"                                  │
│ anchorDistrict: null                                         │
│ anchorRegion: "New York"                                     │
│ anchorCountry: "USA"                                         │
│ isActive: true/false                                         │
└─────────────────────────────────────────────────────────────┘
```

**Rationale**: 
- Single active wave per user simplifies the mental model — photos go into "my current wave"
- Anchor fields provide a stable comparison point for incoming photos
- Field-based matching (not distance) is deterministic and doesn't require haversine calculations

**Alternatives considered**:
- Distance-based matching: More forgiving of naming variations, but requires threshold tuning and is computationally heavier
- Multiple active waves: More flexible but complex to manage (which wave gets new photos?)

### Decision 2: groupingLevel Stored on Wave, Not Passed Per-Photo

**Choice**: When auto-group creates a new wave, it stores the `groupingLevel` passed by the client. Subsequent auto-group calls compare the passed `groupingLevel` against the active wave's stored `groupingLevel`. If they differ → create new wave.

**Rationale**:
- The groupingLevel is a session parameter — the user might want to group at different granularities at different times
- Storing it on the wave preserves the history of how each wave was created
- A mismatch signals the user's intent to start a new grouping session

**Alternatives considered**:
- Always use the client's passed groupingLevel without storing: Loses history of how waves were created
- Store groupingLevel separately from waves: Couples wave creation to a global setting

### Decision 3: Batch Processing All Ungrouped Photos

**Choice**: `autoGroupPhotosIntoWaves` processes ALL ungrouped photos chronologically in a single call. It walks through photos, adding each to the active wave or creating a new wave as needed. Returns result for the LAST wave created/updated.

```
autoGroupPhotosIntoWaves(uuid, groupingLevel):
  1. Get active wave (if any)
  2. Get ALL ungrouped photos (ORDER BY createdAt ASC)
  3. For each photo:
     a. If groupingLevel changed → create new wave
     b. If photo doesn't fit → create new wave
     c. Else → add to active wave
  4. Return result for last wave
```

**Rationale**:
- One call = all photos processed, no client-side looping needed
- Chronological processing ensures waves are created in the order photos were taken
- The last wave's state is returned (it's the "current" wave)

**Alternatives considered**:
- One photo per call: Simpler but requires client-side looping and multiple network round-trips
- Paginated batches: Unnecessary complexity for this use case

### Decision 4: Remove localityLevel from Photo

**Choice**: `localityLevel` is removed from the Photo GraphQL type, Photo model, and `createPhoto` mutation. Photos are stored with raw geocode fields (locality, district, region, country, countryCode) but no explicit granularity level. The granularity is determined by the Wave's `groupingLevel` at auto-group time.

**Rationale**:
- `localityLevel` was redundant — the Wave's `groupingLevel` determines how photos are grouped
- Removing it simplifies the photo upload flow and reduces schema complexity
- The geocode fields themselves (locality, district, etc.) are sufficient for field-based matching

**Alternatives considered**:
- Keep localityLevel as metadata: Adds schema complexity without functional benefit
- Use localityLevel for something else: No clear use case identified

### Decision 5: Photo Upload Does Not Assign to Wave

**Choice**: `createPhoto` stores the photo with geocode fields but does NOT add it to any wave. Photos remain "ungrouped" (not in WavePhotos table) until `autoGroupPhotosIntoWaves` is invoked.

**Rationale**:
- Separates concerns: upload is about storing the photo, auto-group is about organizing it
- Allows the user to configure grouping level before photos are assigned
- Avoids creating waves automatically during upload (wave creation is an explicit auto-group action)

**Alternatives considered**:
- Auto-create wave on first photo: Premature — user hasn't configured grouping level yet
- Add photo to existing wave on upload: Couples upload to wave state, makes rollback harder

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Large batch processing of many ungrouped photos could timeout Lambda | Process in controlled loops; existing MAX_PHOTOS_PER_WAVE=1000 limit applies |
| Users may expect photos to appear in waves immediately after upload | Document that auto-group is required; client can auto-trigger after upload |
| Existing waves lack anchor fields after migration | Backfill anchor columns from existing wave data via migration |
| Removing localityLevel from Photo is a breaking schema change | Coordinate with client updates; localityLevel was not widely used |
| Single active wave per user limits flexibility | Sufficient for current use case; can be extended later if needed |

## Migration Plan

1. **Database migrations** (run first):
   - DROP COLUMN `locality_level` FROM `Photos`
   - ADD columns `anchorLocality`, `anchorDistrict`, `anchorRegion`, `anchorCountry`, `isActive` TO `Waves`
   - Backfill anchor columns from existing wave data (first photo's geocode fields)
   - Mark oldest wave per user as `isActive=true`, all others as `isActive=false`

2. **GraphQL schema update** (deploy with code):
   - Remove `localityLevel` from Photo type
   - Remove `localityLevel` from createPhoto mutation
   - Add anchor fields and isActive to Wave type
   - Add `isNewWave` to AutoGroupResult
   - Make `groupingLevel` required on autoGroupPhotosIntoWaves

3. **Lambda function updates** (deploy with code):
   - Rewrite `autoGroupPhotosIntoWaves.ts` with new active wave logic
   - Update `create.ts` to not store localityLevel
   - Update `getWave.ts` to include anchor fields

4. **Client updates** (deploy separately):
   - Remove localityLevel from createPhoto calls
   - Update autoGroup result handling for isNewWave flag
   - Update UI to reflect active wave model

5. **Rollback**: If issues arise, revert Lambda functions and GraphQL schema. Database migration is irreversible but safe (adding columns is additive, removing locality_level only affects new uploads).

## Open Questions

None — all decisions clarified in explore mode.
