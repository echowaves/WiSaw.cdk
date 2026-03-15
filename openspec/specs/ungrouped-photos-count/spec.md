## ADDED Requirements

### Requirement: Get ungrouped photos count
The system SHALL return the count of active photos belonging to a given UUID that are not associated with any wave.

#### Scenario: User has ungrouped photos
- **WHEN** `getUngroupedPhotosCount(uuid)` is called and the user has active photos not in any wave
- **THEN** the system SHALL return the integer count of those ungrouped photos

#### Scenario: User has no ungrouped photos
- **WHEN** `getUngroupedPhotosCount(uuid)` is called and all active photos belong to at least one wave
- **THEN** the system SHALL return 0

#### Scenario: Invalid UUID format
- **WHEN** `getUngroupedPhotosCount(uuid)` is called with an invalid UUID
- **THEN** the system SHALL throw an error
