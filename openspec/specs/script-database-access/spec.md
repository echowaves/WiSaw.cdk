## ADDED Requirements

### Requirement: Utility scripts map username to user for pg compatibility
All utility scripts in `scripts/` that create `ServerlessClient` instances SHALL explicitly set `user: config.username` in the constructor options. This ensures the database user from `.env.*` files (which export `username` per Sequelize convention) is correctly passed to `pg.Client` (which expects `user`).

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
