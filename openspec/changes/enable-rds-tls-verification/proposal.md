## Why

The application currently sets `NODE_TLS_REJECT_UNAUTHORIZED=0` globally, disabling TLS certificate verification for all outbound connections including PostgreSQL. This suppresses a Node.js `DeprecationWarning` but leaves the Lambda-to-RDS connection vulnerable to man-in-the-middle attacks. While the risk is low within AWS, enabling proper TLS verification is a security hardening best practice and eliminates the runtime warning.

## What Changes

- Bundle the AWS RDS CA certificate (`global-bundle.pem`) with Lambda deployments
- Configure `pg.Client` SSL to use the bundled CA cert via the `ca` option
- Configure Sequelize (migrations) SSL to use the bundled CA cert
- Set `NODE_TLS_REJECT_UNAUTHORIZED=1` (or remove it entirely) in all `.env.*` files
- Remove the global TLS bypass from Lambda environment variables

## Capabilities

### New Capabilities
- `rds-tls-verification`: Proper TLS certificate verification for RDS connections using the Amazon RDS CA bundle, covering both runtime (`pg.Client` via `psql.ts`) and migration (`config/config.js` via Sequelize) paths

### Modified Capabilities
- `database-access-patterns`: SSL configuration in `ManagedServerlessClient` changes from `rejectUnauthorized: false` to `rejectUnauthorized: true` with explicit `ca` certificate

## Impact

- `lambda-fns/psql.ts` — SSL config gains explicit `ca` option pointing to bundled RDS CA cert
- `config/config.js` — Sequelize `dialectOptions.ssl` gains `ca` option
- `.env.sample`, `.env.prod`, `.env.test` — `NODE_TLS_REJECT_UNAUTHORIZED` removed or set to `1`
- `lib/wi_saw.cdk-stack.ts` or `lib/resources/lambdas.ts` — may need to bundle the CA cert file with Lambda code
- New file: RDS CA bundle (`global-bundle.pem` or `us-east-1-bundle.pem`) added to the project
- RDS instance uses `rds-ca-rsa2048-g1` certificate; the Amazon RDS Root CA RSA2048 G1 is NOT in Node.js's default trust store, so the CA must be explicitly provided
