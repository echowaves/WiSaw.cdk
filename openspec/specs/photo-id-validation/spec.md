## ADDED Requirements

### Requirement: photoId validation uses assertValidUuid
Controllers that accept `photoId` SHALL validate with `assertValidUuid(photoId, 'photoId')`.

#### Scenario: Invalid photoId
- **WHEN** `photoId` is malformed
- **THEN** controller throws `Wrong UUID format for photoId: "<value>"`

#### Scenario: Valid photoId accepted
- **WHEN** `photoId` conforms to shared UUID structural validation
- **THEN** controller proceeds to business logic/SQL

### Requirement: Shared UUID checker behavior is used across id fields
The same shared checker is used for `photoId`, `waveUuid`, and `uuid` in controller entry points.

#### Scenario: Error message includes field name
- **WHEN** any id validation fails
- **THEN** thrown error includes the specific field key (`photoId`, `waveUuid`, or `uuid`)