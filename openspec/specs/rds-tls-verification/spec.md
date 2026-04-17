## ADDED Requirements

### Requirement: Lambda DB connections verify TLS using bundled CA
`psql` imports RDS CA bundle and connects with SSL `{ ca, rejectUnauthorized: true }`.

### Requirement: Current Lambda bundling supports PEM import
Current lambda definitions include `.pem` text loader where required for certificate import in bundled code.

### Requirement: Global TLS bypass env var is not required
Implementation does not rely on `NODE_TLS_REJECT_UNAUTHORIZED` bypass.

### Requirement: Sequelize migration config verifies TLS
`config/config.js` loads CA bundle and uses `rejectUnauthorized: true` in SSL configuration.
