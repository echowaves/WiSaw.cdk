## ADDED Requirements

### Requirement: Register identity by uuid, nickName, and secret
`registerSecret(uuid, nickName, secret)` SHALL validate inputs, use parameterized SQL, and create or resolve identity by nickName.

#### Scenario: New nickName
- **WHEN** nickName is unused and input is valid
- **THEN** a new `Secrets` record is created and returned

#### Scenario: Existing nickName with matching secret
- **WHEN** nickName exists and provided secret hash matches stored hash
- **THEN** existing identity record is returned

#### Scenario: Existing nickName with wrong secret
- **WHEN** nickName exists and secret does not match
- **THEN** request fails

#### Scenario: Invalid uuid rejected
- **WHEN** provided `uuid` fails shared UUID validation
- **THEN** register request fails before insert/update SQL

#### Scenario: Invalid nickName rejected
- **WHEN** nickName fails controller validation rules
- **THEN** register request fails

### Requirement: Update secret requires current secret verification
`updateSecret(uuid, nickName, secret, newSecret)` SHALL verify the current secret before persisting the replacement hash.

#### Scenario: Current secret matches
- **WHEN** current secret hash matches stored value
- **THEN** hash is replaced and updated identity is returned

#### Scenario: Current secret mismatch
- **WHEN** current secret hash does not match
- **THEN** update request fails and existing hash remains unchanged

### Requirement: Secrets are stored hashed with SHA-256
The current implementation stores SHA-256 hashes (from `controllers/secrets/_hash.ts`) and never stores plaintext secrets.

#### Scenario: Register/update stores hash only
- **WHEN** secret values are persisted
- **THEN** only SHA-256 hash is written

#### Scenario: Plaintext not returned in API response
- **WHEN** register or update succeeds
- **THEN** response does not expose plaintext secret