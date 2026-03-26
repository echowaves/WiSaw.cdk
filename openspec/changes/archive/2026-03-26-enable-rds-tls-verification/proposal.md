## Why

All Lambda functions and migration scripts currently disable TLS certificate verification for PostgreSQL connections by setting `NODE_TLS_REJECT_UNAUTHORIZED='0'` globally. This means the application accepts any certificate — including potentially fraudulent ones — when connecting to RDS, defeating the purpose of TLS. This is a security risk flagged in production logs and violates best practices for database connectivity.

A previous attempt to simply set `ssl: { rejectUnauthorized: true }` without providing a CA certificate failed in production because Node.js 22 on AWS Lambda does not trust the RDS intermediate CA (`rds-ca-rsa2048-g1`) natively. The correct fix requires bundling the AWS RDS CA certificate bundle.

## What Changes

- Bundle the AWS RDS global CA certificate (`global-bundle.pem`) into Lambda deployments using esbuild's `text` loader
- Update `psql.ts` to use `ssl: { ca: rdsCa, rejectUnauthorized: true }` instead of `ssl: true`
- Add `loader: { '.pem': 'text' }` to all 7 `NodejsFunction` bundling configs in the CDK stack
- Remove `NODE_TLS_REJECT_UNAUTHORIZED` from all `.env.*` files and Lambda environment variables
- Update `config/config.js` to load the CA bundle via `fs.readFileSync` for Sequelize migrations with `rejectUnauthorized: true`
- Update local scripts to use `ssl: { rejectUnauthorized: false }` and remove the `NODE_TLS_REJECT_UNAUTHORIZED` environment manipulation block

## Capabilities

### New Capabilities
- `rds-tls-verification`: Proper TLS certificate verification for all RDS PostgreSQL connections using the bundled AWS CA certificate

### Modified Capabilities
- `database-access-patterns`: The `psql` singleton SSL configuration changes from `ssl: true` (with global TLS bypass) to `ssl: { ca: rdsCa, rejectUnauthorized: true }` (with explicit CA certificate)
- `script-database-access`: Scripts change from `ssl: true` with `NODE_TLS_REJECT_UNAUTHORIZED='0'` to `ssl: { rejectUnauthorized: false }` without the environment variable manipulation

## Impact

- **Lambda functions**: All 7 `NodejsFunction` definitions need bundling config changes; `psql.ts` needs SSL config update
- **CDK stack**: `lib/resources/lambdas.ts` bundling configs updated with `.pem` loader
- **Environment files**: `.env.sample`, `.env.test`, `.env.prod` lose the `NODE_TLS_REJECT_UNAUTHORIZED` variable
- **Migrations**: `config/config.js` updated to load CA cert and verify
- **Scripts**: 3 utility scripts updated to use `rejectUnauthorized: false` and remove TLS bypass blocks
- **New files**: `lambda-fns/certs/global-bundle.pem` (CA bundle), `lambda-fns/certs/pem.d.ts` (TypeScript declaration)
- **No dependency changes**: Uses existing esbuild capabilities and Node.js `tls` module
