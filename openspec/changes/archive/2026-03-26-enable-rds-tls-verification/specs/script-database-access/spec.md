## MODIFIED Requirements

### Requirement: Utility scripts map username to user for pg compatibility
All utility scripts in `scripts/` that create `ServerlessClient` instances SHALL explicitly set `user: config.username` in the constructor options. Scripts SHALL use `ssl: { rejectUnauthorized: false }` for database connections and SHALL NOT manipulate the `NODE_TLS_REJECT_UNAUTHORIZED` environment variable.

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

#### Scenario: Scripts use ssl with rejectUnauthorized false
- **WHEN** any utility script creates a `ServerlessClient`
- **THEN** it SHALL pass `ssl: { rejectUnauthorized: false }` instead of `ssl: true`

#### Scenario: Scripts do not manipulate NODE_TLS_REJECT_UNAUTHORIZED
- **WHEN** any utility script is executed
- **THEN** it SHALL NOT set or read `process.env.NODE_TLS_REJECT_UNAUTHORIZED`
