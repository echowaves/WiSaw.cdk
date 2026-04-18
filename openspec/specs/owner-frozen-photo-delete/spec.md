### Requirement: Wave owner can soft-delete photos from frozen waves
The `deletePhoto` mutation SHALL allow the wave owner to soft-delete a photo that is in their frozen wave. Non-owner callers SHALL continue to be blocked from deleting photos in frozen waves.

#### Scenario: Owner deletes photo from their frozen wave
- **WHEN** the caller is the owner of the wave that contains the photo AND the wave is frozen
- **THEN** the system SHALL soft-delete the photo (set `active = false`) and update the wave's `photosCount`

#### Scenario: Non-member deletes photo from frozen wave
- **WHEN** the caller is not a member of the wave that contains the photo AND the wave is frozen
- **THEN** the system SHALL reject the deletion with an error indicating the photo is in a frozen wave

#### Scenario: Contributor deletes photo from frozen wave
- **WHEN** the caller is a contributor of the wave that contains the photo AND the wave is frozen
- **THEN** the system SHALL reject the deletion with an error indicating the photo is in a frozen wave

#### Scenario: Facilitator deletes photo from frozen wave
- **WHEN** the caller is a facilitator of the wave that contains the photo AND the wave is frozen
- **THEN** the system SHALL reject the deletion with an error indicating the photo is in a frozen wave

#### Scenario: Photo not in any wave
- **WHEN** the photo is not in any wave
- **THEN** the system SHALL soft-delete the photo normally with no wave-related checks

#### Scenario: Photo in unfrozen wave
- **WHEN** the photo is in an unfrozen wave
- **THEN** the system SHALL soft-delete the photo normally and update the wave's `photosCount`

### Requirement: Frozen-wave delete-photo checks use effective freeze
Photo delete protection SHALL use effective wave freeze state with explicit freeze precedence. Non-owner callers SHALL be blocked only when effective state is frozen.

#### Scenario: Non-owner blocked by explicit FROZEN
- **WHEN** caller is not owner and photo belongs to wave with `freezeMode=FROZEN`
- **THEN** deletion is rejected as frozen-wave protected

#### Scenario: Non-owner allowed by explicit UNFROZEN
- **WHEN** caller is not owner and photo belongs to wave with `freezeMode=UNFROZEN` while date rule would be frozen
- **THEN** deletion proceeds with normal photo-delete behavior

#### Scenario: AUTO keeps existing behavior
- **WHEN** wave has `freezeMode=AUTO`
- **THEN** frozen-wave delete protections follow date-derived freeze behavior
