## ADDED Requirements

### Requirement: Photo ID format validation utility
The system SHALL provide a shared `isValidPhotoId` function at `lambda-fns/utilities/isValidPhotoId.ts` that validates whether a string matches the UUID format pattern (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` where `x` is a hexadecimal character). The function SHALL NOT enforce RFC 4122 version or variant bits, because photo IDs may be legacy values migrated from integer IDs.

#### Scenario: Valid RFC 4122 v4 UUID accepted
- **WHEN** `isValidPhotoId` is called with `"a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789"`
- **THEN** it returns `true`

#### Scenario: Legacy migrated photo ID accepted
- **WHEN** `isValidPhotoId` is called with `"00000000-0000-0000-0000-000000021212"`
- **THEN** it returns `true`

#### Scenario: Empty string rejected
- **WHEN** `isValidPhotoId` is called with `""`
- **THEN** it returns `false`

#### Scenario: Non-UUID string rejected
- **WHEN** `isValidPhotoId` is called with `"not-a-uuid"`
- **THEN** it returns `false`

### Requirement: All controllers that accept photoId use relaxed validation
All 11 controllers that receive `photoId` from GraphQL SHALL use `isValidPhotoId` for validating the `photoId` parameter. Controllers that also validate other UUID parameters (`waveUuid`, `uuid`) SHALL continue using `uuidValidate` from the `uuid` library for those.

Affected controllers:
- `waves/addPhoto.ts` — replace existing `uuidValidate(photoId)` with `isValidPhotoId(photoId)`
- `waves/removePhoto.ts` — replace existing `uuidValidate(photoId)` with `isValidPhotoId(photoId)`
- `photos/delete.ts` — add `isValidPhotoId(photoId)` guard
- `photos/watch.ts` — add `isValidPhotoId(photoId)` guard
- `photos/unwatch.ts` — add `isValidPhotoId(photoId)` guard
- `photos/getPhotoDetails.ts` — add `isValidPhotoId(photoId)` guard
- `photos/getPhotoAllCurr.ts` — add `isValidPhotoId(photoId)` guard
- `photos/getPhotoAllNext.ts` — add `isValidPhotoId(photoId)` guard
- `photos/getPhotoAllPrev.ts` — add `isValidPhotoId(photoId)` guard
- `abuseReports/create.ts` — add `isValidPhotoId(photoId)` guard
- `comments/create.ts` — add `isValidPhotoId(photoId)` guard

#### Scenario: removePhotoFromWave accepts legacy photo ID
- **WHEN** `removePhotoFromWave` is called with photoId `"00000000-0000-0000-0000-000000021212"` and a valid waveUuid
- **THEN** the photoId validation passes and the operation proceeds

#### Scenario: addPhotoToWave accepts legacy photo ID
- **WHEN** `addPhotoToWave` is called with photoId `"00000000-0000-0000-0000-000000021212"`, a valid waveUuid, and a valid uuid
- **THEN** the photoId validation passes and the operation proceeds

#### Scenario: deletePhoto rejects garbage photoId
- **WHEN** `deletePhoto` is called with photoId `"not-a-uuid"`
- **THEN** the operation fails with error "Wrong UUID format for photoId"

#### Scenario: createComment accepts legacy photo ID
- **WHEN** `createComment` is called with photoId `"00000000-0000-0000-0000-000000021212"`
- **THEN** the photoId validation passes and the operation proceeds

#### Scenario: waveUuid still uses strict validation
- **WHEN** `addPhotoToWave` is called with waveUuid `"00000000-0000-0000-0000-000000000001"` (non-RFC-4122)
- **THEN** the waveUuid validation fails with error "Wrong UUID format for waveUuid"
