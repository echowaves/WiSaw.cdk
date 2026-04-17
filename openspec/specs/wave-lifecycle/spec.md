## ADDED Requirements

### Requirement: Wave lifecycle state is date-based
Wave mutability SHALL be determined from `splashDate` and `freezeDate`. A wave is treated as frozen when current time is before `splashDate` or after `freezeDate`.

#### Scenario: Before splash date
- **WHEN** `now < splashDate`
- **THEN** wave is considered frozen for contribution flows

#### Scenario: After freeze date
- **WHEN** `now > freezeDate`
- **THEN** wave is considered frozen for contribution flows

### Requirement: Frozen checks use shared helpers
The implementation SHALL use `_isWaveFrozen(wave)` and `_assertNotFrozen(wave)` to gate mutating operations that require a mutable wave.

### Requirement: Frozen protection applies to photo/comment flows
If a photo belongs to a frozen wave, create/delete comment and global delete-photo operations are blocked by shared frozen checks, with implemented owner exceptions in wave-role-specific paths.

#### Scenario: Comment create blocked
- **WHEN** `createComment` targets a photo in frozen wave
- **THEN** request fails

#### Scenario: Comment delete blocked
- **WHEN** `deleteComment` targets a photo in frozen wave
- **THEN** request fails

### Requirement: Owner exception for full wave deletion
Wave owner can delete a wave even when frozen.

### Requirement: Wave API includes computed frozen state
Wave responses include `isFrozen`. The current API does not include `isActive` and does not persist a separate `frozen` boolean field.