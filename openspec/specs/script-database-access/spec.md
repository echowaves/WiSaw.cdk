## ADDED Requirements

### Requirement: Utility scripts map username to user for pg compatibility
All utility scripts in `scripts/` that create `ServerlessClient` instances SHALL explicitly set `user: config.username` in the constructor options. Scripts SHALL load the RDS CA bundle from `lambda-fns/certs/global-bundle.pem` via `fs.readFileSync` and connect with `ssl: { ca: rdsCa, rejectUnauthorized: true }`. Scripts SHALL NOT use `ssl: { rejectUnauthorized: false }` and SHALL NOT manipulate the `NODE_TLS_REJECT_UNAUTHORIZED` environment variable.

#### Scenario: cleanup-s3.js connects with correct user
- **WHEN** `npm run cleanup-s3 prod` is executed
- **THEN** the `ServerlessClient` SHALL connect using `user: config.username` (e.g., `'awsroot'`), not the OS username

#### Scenario: populate-photo-dimensions.js connects with correct user
- **WHEN** `npm run populate-dimensions prod` is executed
- **THEN** the `ServerlessClient` SHALL connect using `user: config.username`

#### Scenario: populate-recognitions.js connects with correct user
- **WHEN** `npm run populate-recognitions prod` is executed
- **THEN** the `ServerlessClient` SHALL connect using `user: config.username`

#### Scenario: Spread config does not override explicit user
- **WHEN** `...config` is spread into the `ServerlessClient` constructor alongside `user: config.username`
- **THEN** the explicit `user` property SHALL take precedence over any `user` or `username` from the spread

#### Scenario: Scripts use CA-verified TLS
- **WHEN** any utility script creates a `ServerlessClient`
- **THEN** it SHALL pass `ssl: { ca: rdsCa, rejectUnauthorized: true }` where `rdsCa` is the contents of `lambda-fns/certs/global-bundle.pem`

#### Scenario: Scripts do not manipulate NODE_TLS_REJECT_UNAUTHORIZED
- **WHEN** any utility script is executed
- **THEN** it SHALL NOT set or read `process.env.NODE_TLS_REJECT_UNAUTHORIZED`
