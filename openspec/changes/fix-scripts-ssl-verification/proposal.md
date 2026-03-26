## Why

The recent RDS TLS changes added proper certificate verification for Lambda functions and Sequelize migrations, but the three utility scripts in `scripts/` still use `ssl: { rejectUnauthorized: false }`, which disables TLS certificate verification and is flagged as CRITICAL by Codacy. These scripts should use the same CA bundle (`global-bundle.pem`) that Lambdas and migrations already use, closing the remaining security gap.

## What Changes

- Update `scripts/cleanup-s3.js`, `scripts/populate-photo-dimensions.js`, and `scripts/populate-recognitions.js` to load the RDS CA bundle and connect with `ssl: { ca: rdsCa, rejectUnauthorized: true }` instead of `ssl: { rejectUnauthorized: false }`.
- Update the `script-database-access` spec to require CA-verified TLS connections, aligning with the `rds-tls-verification` spec.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `script-database-access`: Scripts must use the RDS CA bundle for TLS verification instead of disabling certificate checks.

## Impact

- **Code**: `scripts/cleanup-s3.js`, `scripts/populate-photo-dimensions.js`, `scripts/populate-recognitions.js` — SSL config changes.
- **Dependencies**: No new dependencies. The CA bundle at `lambda-fns/certs/global-bundle.pem` is already present.
- **Security**: Resolves 3 CRITICAL Codacy findings (SSL rejectUnauthorized: false). Also resolves the false-positive File Access finding in `config/config.js` by context (no change needed there).
