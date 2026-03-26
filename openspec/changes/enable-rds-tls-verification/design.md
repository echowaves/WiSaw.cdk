## Context

The application connects to AWS RDS PostgreSQL 18.1 from Lambda (Node.js 22.x). The RDS instance uses certificate `rds-ca-rsa2048-g1` with a chain: leaf cert → Amazon RDS us-east-1 Subordinate CA RSA2048 G1.A.3 → Amazon RDS us-east-1 Root CA RSA2048 G1. This root CA is **not** in Node.js's default Mozilla trust store, so `rejectUnauthorized: true` fails with "self-signed certificate in certificate chain" unless the CA is explicitly provided.

Currently `NODE_TLS_REJECT_UNAUTHORIZED=0` is set in all `.env.*` files and spread into every Lambda's environment, globally disabling TLS verification.

Two code paths establish TLS connections to RDS:
1. **Runtime**: `lambda-fns/psql.ts` — `ManagedServerlessClient` wrapping `serverless-postgres` / `pg.Client`
2. **Migrations**: `config/config.js` — Sequelize `dialectOptions.ssl`

## Goals / Non-Goals

**Goals:**
- Enable `rejectUnauthorized: true` for all RDS connections
- Bundle the RDS CA certificate with Lambda deployments
- Eliminate the `NODE_TLS_REJECT_UNAUTHORIZED` runtime warning
- Maintain compatibility with both runtime and migration paths

**Non-Goals:**
- Mutual TLS (client certificates) — not required for RDS
- Rotating or upgrading the RDS CA certificate authority — separate concern
- Enabling TLS for non-RDS connections (none exist currently)

## Decisions

### 1. Bundle CA via `ssl.ca` option (not `NODE_EXTRA_CA_CERTS`)

**Choice**: Pass the CA certificate directly in `pg.Client` config via `ssl: { rejectUnauthorized: true, ca: fs.readFileSync(...) }` rather than using the `NODE_EXTRA_CA_CERTS` environment variable.

**Rationale**: `ssl.ca` is explicit, scoped to the pg connection, and doesn't require CDK changes to set environment variables pointing to file paths inside the Lambda runtime. `NODE_EXTRA_CA_CERTS` must be set before Node starts, making it more fragile with Lambda's execution model.

**Alternative considered**: `NODE_EXTRA_CA_CERTS` — simpler but requires knowing the exact file path inside the Lambda deployment package at CDK config time, and affects all TLS connections globally.

### 2. Use region-specific bundle (not global)

**Choice**: Download `us-east-1-bundle.pem` rather than `global-bundle.pem`.

**Rationale**: Smaller file (~50KB vs ~250KB). The application is deployed exclusively in us-east-1. If multi-region is ever needed, switch to global bundle.

**Alternative considered**: `global-bundle.pem` — works everywhere but unnecessarily large when only us-east-1 is used.

### 3. Place CA bundle at `lambda-fns/certs/us-east-1-bundle.pem`

**Choice**: Store the certificate in the Lambda source tree so it's automatically included in the deployment bundle.

**Rationale**: CDK bundles the `lambda-fns/` directory for Lambda code. Placing the cert there ensures it ships with every Lambda without additional CDK `bundling` configuration.

### 4. Read cert at module load time

**Choice**: `const RDS_CA = fs.readFileSync(path.join(__dirname, 'certs/us-east-1-bundle.pem'), 'utf8')` at the top level of `psql.ts`.

**Rationale**: Module-level read happens once per cold start. The cert is needed on every connection and doesn't change. Avoids repeated file I/O.

## Risks / Trade-offs

- **[Certificate expiry]** → RDS CA certs have long validity periods (typically 5+ years). Monitor AWS announcements for CA rotations. When rotated, update the bundled cert and redeploy.
- **[Build size increase]** → ~50KB added to each Lambda. Negligible impact on cold start.
- **[Migration path difference]** → Migrations run locally/CI, not in Lambda. They need the same CA cert. The cert file is in the repo, so `config.js` can reference it with a relative path. If running migrations from a machine that can't reach RDS (e.g., behind VPN), TLS verification already isn't the blocker.
- **[Rollback]** → If TLS verification causes issues, revert by setting `rejectUnauthorized: false` in the SSL config. No need to revert `NODE_TLS_REJECT_UNAUTHORIZED=0` as a fallback.

## Open Questions

- Should `NODE_TLS_REJECT_UNAUTHORIZED` be removed entirely from `.env.*` files or set to `1`? Removing is cleaner; setting to `1` is more explicit. Leaning toward removal since the per-connection `ca` config makes it unnecessary.
