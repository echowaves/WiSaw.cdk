## ADDED Requirements

### Requirement: Lambda DB connections verify TLS using bundled CA
`psql` imports RDS CA bundle and connects with SSL `{ ca, rejectUnauthorized: true }`.

#### Scenario: Valid RDS cert chain
- **WHEN** DB endpoint presents certificate signed by bundled CA chain
- **THEN** TLS handshake succeeds

#### Scenario: Untrusted cert chain
- **WHEN** endpoint certificate does not validate against bundled CA
- **THEN** connection fails due to TLS validation

### Requirement: Current Lambda bundling supports PEM import
Current lambda definitions include `.pem` text loader where required for certificate import in bundled code.

#### Scenario: Build resolves PEM import
- **WHEN** lambda bundle is created
- **THEN** PEM file is inlined/resolved via configured loader

### Requirement: Global TLS bypass env var is not required
Implementation does not rely on `NODE_TLS_REJECT_UNAUTHORIZED` bypass.

#### Scenario: No global bypass dependency
- **WHEN** runtime env lacks bypass variable
- **THEN** DB connection behavior remains governed by explicit ssl config

### Requirement: Sequelize migration config verifies TLS
`config/config.js` loads CA bundle and uses `rejectUnauthorized: true` in SSL configuration.

#### Scenario: Migration CLI TLS verification
- **WHEN** sequelize migration command runs
- **THEN** connection uses CA-backed TLS verification settings
