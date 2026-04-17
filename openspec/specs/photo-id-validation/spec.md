## ADDED Requirements

### Requirement: photoId validation uses assertValidUuid
Controllers that accept `photoId` SHALL validate with `assertValidUuid(photoId, 'photoId')`.

#### Scenario: Invalid photoId
- **WHEN** `photoId` is malformed
- **THEN** controller throws `Wrong UUID format for photoId: "<value>"`

### Requirement: Shared UUID checker behavior is used across id fields
The same shared checker is used for `photoId`, `waveUuid`, and `uuid` in controller entry points.