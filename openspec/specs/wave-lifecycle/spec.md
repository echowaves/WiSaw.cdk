## ADDED Requirements

### Requirement: Wave lifecycle state is date-based
Wave mutability SHALL be determined from `splashDate` and `freezeDate`. A wave is treated as frozen when current time is before `splashDate` or after `freezeDate`.

#### Scenario: Before splash date
- **WHEN** `now < splashDate`
- **THEN** wave is considered frozen for contribution flows

#### Scenario: After freeze date
- **WHEN** `now > freezeDate`
- **THEN** wave is considered frozen for contribution flows

#### Scenario: Inside active date window
- **WHEN** `splashDate <= now <= freezeDate`
- **THEN** wave is not frozen by date rules

### Requirement: Frozen checks use shared helpers
The implementation SHALL use `_isWaveFrozen(wave)` and `_assertNotFrozen(wave)` to gate mutating operations that require a mutable wave.

#### Scenario: Helper-based mutation guard
- **WHEN** a wave mutation path requires mutability
- **THEN** the path uses helper checks rather than duplicating date logic inline

### Requirement: Frozen protection applies to photo/comment flows
If a photo belongs to a frozen wave, create/delete comment and global delete-photo operations are blocked by shared frozen checks, with implemented owner exceptions in wave-role-specific paths.

#### Scenario: Comment create blocked
- **WHEN** `createComment` targets a photo in frozen wave
- **THEN** request fails

#### Scenario: Comment delete blocked
- **WHEN** `deleteComment` targets a photo in frozen wave
- **THEN** request fails

#### Scenario: Non-owner photo delete blocked in frozen wave
- **WHEN** photo belongs to frozen wave and caller is not eligible owner exception path
- **THEN** global delete-photo request fails

### Requirement: Owner exception for full wave deletion
Wave owner can delete a wave even when frozen.

#### Scenario: Frozen wave delete by owner
- **WHEN** owner calls delete on a frozen wave
- **THEN** delete proceeds

### Requirement: Wave API includes computed frozen state
Wave responses include `isFrozen`. The current API does not include `isActive` and does not persist a separate `frozen` boolean field.

#### Scenario: API Shape Excludes `isActive`
- **WHEN** wave object is returned through GraphQL
- **THEN** client gets `isFrozen` but not `isActive`