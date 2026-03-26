## Why

All three utility scripts in `scripts/` (`cleanup-s3.js`, `populate-photo-dimensions.js`, `populate-recognitions.js`) fail to connect to the production database with "password authentication failed for user dmitry". The `.env.prod` config exports `username: 'awsroot'` (Sequelize convention) but `pg.Client` expects the `user` property. The scripts spread `...config` without mapping `username` → `user`, so pg falls back to the OS username. This is the same bug that was fixed in `lambda-fns/psql.ts` but the scripts were missed because they create their own `ServerlessClient` instances directly.

## What Changes

- Add `user: config.username` to the `ServerlessClient` constructor in all three scripts
- Also add `password: config.password, database: config.database, host: config.host, port: config.port` explicitly for clarity and to avoid relying on spread behavior for critical connection params

## Capabilities

### New Capabilities
- `script-database-access`: Rules for how utility scripts in `scripts/` create database connections, ensuring the `username` → `user` mapping is applied consistently

### Modified Capabilities

_(none — the existing `database-access-patterns` spec covers `ManagedServerlessClient` in Lambda, not standalone scripts)_

## Impact

- `scripts/cleanup-s3.js` — database connection config
- `scripts/populate-photo-dimensions.js` — database connection config
- `scripts/populate-recognitions.js` — database connection config
