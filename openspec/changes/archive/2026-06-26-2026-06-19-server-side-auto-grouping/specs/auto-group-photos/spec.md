# Spec: Server-Side Auto-Grouping

## ADDED Requirements

### Requirement: Auto-grouping triggered after photo upload

**WHEN** a photo is uploaded via S3 event  
**THEN** the `processUploadedImage` Lambda SHALL trigger auto-grouping automatically  
**AND** auto-grouping SHALL use `groupingLevel: 'CITY'` (50km)

#### Scenario: New photo upload triggers auto-grouping
- **GIVEN** user uploads a new photo with geocode data
- **WHEN** S3 event triggers `processUploadedImage` Lambda
- **AND** photo activation completes
- **THEN** `autoGroupPhotosIntoWaves(uuid, 'CITY')` is called
- **AND** photos are grouped into appropriate waves

#### Scenario: Historical photos processed on first upload
- **GIVEN** user has 5,000 historical ungrouped photos
- **WHEN** user uploads first photo
- **THEN** auto-grouping processes ALL ungrouped photos in batches
- **AND** waves are created for each batch
- **AND** photos are grouped into waves

#### Scenario: Subsequent uploads process single photo
- **GIVEN** user has no ungrouped photos
- **WHEN** user uploads another photo
- **THEN** auto-grouping checks count and skips (0 ungrouped)
- **AND** no waves created, no errors

---

### Requirement: Subscription notification on upload complete

**WHEN** photo upload + auto-grouping completes  
**THEN** `_notifyPhotoUploadComplete` subscription SHALL publish to all clients  
**AND** payload SHALL contain `photoId`, `waveUuid?`, `photosGrouped`

The controller queries the database to determine which wave the photo was grouped into. The `name` field is omitted since it can be inferred from the `photoId`.

#### Scenario: Client receives upload completion notification
- **GIVEN** client subscribed to `_notifyPhotoUploadComplete(photoId: "...")`
- **WHEN** photo upload completes (including auto-grouping)
- **THEN** subscription publishes with PhotoUploadResult payload
- **AND** client receives notification
- **AND** client refreshes UI

#### Scenario: Notification includes wave info when applicable
- **GIVEN** auto-grouping grouped the photo into an existing or new wave
- **WHEN** subscription publishes
- **THEN** payload includes `waveUuid` and `photosGrouped`
- **AND** `photosGrouped` reflects total photos grouped in this run

#### Scenario: No wave created
- **GIVEN** auto-grouping found no ungrouped photos
- **WHEN** subscription publishes
- **THEN** payload includes `waveUuid: null` and `photosGrouped: 0`

---

### Requirement: Backward compatibility with client-initiated mutation

**WHEN** client calls `autoGroupPhotosIntoWaves` mutation  
**THEN** mutation SHALL work exactly as before  
**AND** `groupingLevel` parameter SHALL still be accepted

#### Scenario: Client calls mutation manually
- **GIVEN** client calls `autoGroupPhotosIntoWaves(uuid, 'REGION')`
- **THEN** mutation executes with REGION grouping level
- **AND** result includes correct grouping level data
- **AND** server-side auto-grouping still works independently

---

## ADDED Types

### PhotoUploadResult

Represents the result of a photo upload + auto-grouping operation.

**Fields:**
- `photoId: String!` - The ID of the photo that was uploaded
- `waveUuid: String` - The UUID of the wave the photo was grouped into (nullable)
- `photosGrouped: Int!` - Total photos grouped in this auto-grouping run

**Example:**
```json
{
  "photoId": "abc-123-def",
  "waveUuid": "wave-uuid-456",
  "photosGrouped": 1500
}
```

---

## ADDED Subscriptions

### _notifyPhotoUploadComplete

Publishes when photo upload and auto-grouping completes.

**Signature:**
```graphql
_subscribe(_notifyPhotoUploadComplete(photoId: String!): PhotoUploadResult)
```

**Arguments:**
- `photoId: String!` - The ID of the photo that was uploaded

**Payload:**
- Returns `PhotoUploadResult` object

**Usage:**
```graphql
subscription {
  _notifyPhotoUploadComplete(photoId: "abc-123") {
    photoId
    waveUuid
    photosGrouped
  }
}
```

---

## MODIFIED Behavior

### processUploadedImage Lambda

**Before:** Photo upload completes after activation, no auto-grouping  
**After:** Photo upload triggers auto-grouping as part of processing

**New Flow:**
```
1. Download image from S3
2. Generate WebP thumbnail
3. Generate full-size WebP
4. Run Rekognition
5. Extract image dimensions
6. Delete upload temp file
7. Activate photo (active=true)
8. [NEW] Loop autoGroupPhotosIntoWaves(uuid, 'CITY') until hasMore = false
9. [NEW] Publish _notifyPhotoUploadComplete subscription with result
10. DONE
```

---

## NON-GOALS

- Not changing auto-grouping algorithm
- Not removing client-initiated mutation
- Not adding configuration UI for grouping level
- Not changing grouping thresholds or algorithm
- Not blocking upload on auto-grouping success
