## MODIFIED Requirements

### Requirement: Scripts use ssl with rejectUnauthorized false
All utility scripts in `scripts/` that create `ServerlessClient` instances SHALL load the RDS CA bundle from `lambda-fns/certs/global-bundle.pem` via `fs.readFileSync` and connect with `ssl: { ca: rdsCa, rejectUnauthorized: true }`. Scripts SHALL NOT use `ssl: { rejectUnauthorized: false }`.

#### Scenario: cleanup-s3.js verifies the RDS server certificate
- **WHEN** `npm run cleanup-s3 prod` is executed
- **THEN** the `ServerlessClient` SHALL connect with `ssl: { ca: rdsCa, rejectUnauthorized: true }` where `rdsCa` is the contents of `lambda-fns/certs/global-bundle.pem`

#### Scenario: populate-photo-dimensions.js verifies the RDS server certificate
- **WHEN** `npm run populate-dimensions prod` is executed
- **THEN** the `ServerlessClient` SHALL connect with `ssl: { ca: rdsCa, rejectUnauthorized: true }`

#### Scenario: populate-recognitions.js verifies the RDS server certificate
- **WHEN** `npm run populate-recognitions prod` is executed
- **THEN** the `ServerlessClient` SHALL connect with `ssl: { ca: rdsCa, rejectUnauthorized: true }`

#### Scenario: Scripts do not manipulate NODE_TLS_REJECT_UNAUTHORIZED
- **WHEN** any utility script is executed
- **THEN** it SHALL NOT set or read `process.env.NODE_TLS_REJECT_UNAUTHORIZED`
