## Context

All Lambda functions connect to RDS PostgreSQL with `ssl: true` while `NODE_TLS_REJECT_UNAUTHORIZED='0'` is set globally via environment variables. This effectively disables TLS certificate verification for all outbound TLS connections — not just PostgreSQL. A prior attempt to enable verification by simply setting `rejectUnauthorized: true` without a CA certificate failed in production: Node.js 22 on AWS Lambda does not trust the RDS intermediate CA (`rds-ca-rsa2048-g1`) natively, resulting in `self-signed certificate in certificate chain` errors.

The RDS instance (`wisaw-prod`) uses the `rds-ca-rsa2048-g1` certificate authority. AWS publishes a combined CA bundle (`global-bundle.pem`) containing all regional and global RDS root/intermediate certificates.

Lambda functions are bundled with esbuild via CDK's `NodejsFunction`. There are 7 Lambda definitions in `lib/resources/lambdas.ts`, all sharing identical bundling patterns. The database client singleton lives in `lambda-fns/psql.ts` and is imported (directly or transitively) by all database-connected Lambdas.

Three local utility scripts (`scripts/cleanup-s3.js`, `scripts/populate-photo-dimensions.js`, `scripts/populate-recognitions.js`) also connect to the database and currently use the same TLS bypass pattern.

## Goals / Non-Goals

**Goals:**
- Enable proper TLS certificate verification for all Lambda-to-RDS connections
- Remove the `NODE_TLS_REJECT_UNAUTHORIZED='0'` environment variable from all environments
- Bundle the AWS RDS CA certificate into Lambda deployments without adding runtime dependencies
- Update Sequelize migration config to verify TLS with the CA certificate

**Non-Goals:**
- Switching from password-based to IAM database authentication
- Enforcing TLS verification in local utility scripts (user prefers `rejectUnauthorized: false` for dev convenience)
- Switching the database client library from `serverless-postgres` to another driver

## Decisions

### Decision 1: Use esbuild `text` loader to bundle the CA certificate

**Choice**: Import the PEM file as a string using esbuild's built-in `text` loader, rather than using `fs.readFileSync` at runtime or esbuild `commandHooks` to copy the file.

**Alternatives considered**:
- **Option A — Inline string constant**: Paste the PEM content directly into `psql.ts`. Works but makes the ~200KB certificate unreadable and hard to update.
- **Option B — esbuild `text` loader** (chosen): Add `loader: { '.pem': 'text' }` to bundling config, import PEM as `import rdsCa from './certs/global-bundle.pem'`. Clean, type-safe, auto-inlined at build time.
- **Option C — `fs.readFileSync` with `commandHooks`**: Copy the PEM to the Lambda output directory via esbuild's `afterBundling` hook, read it at runtime. More complex, fragile across CDK versions.

**Rationale**: Option B is the simplest approach that keeps the certificate as a standalone updatable file while requiring zero runtime filesystem access. esbuild natively supports the `text` loader with no additional configuration beyond the `loader` map.

### Decision 2: Use the AWS global CA bundle (`global-bundle.pem`)

**Choice**: Download and bundle AWS's `global-bundle.pem` which contains all RDS root and intermediate certificates for all regions.

**Rationale**: The global bundle covers all current and future RDS CA rotations across regions. It's ~200KB which is trivial relative to Lambda package limits. Using the global bundle rather than a region-specific certificate avoids breakage if the RDS instance is moved or the CA is rotated.

### Decision 3: TypeScript declaration file for PEM imports

**Choice**: Create `lambda-fns/certs/pem.d.ts` declaring `*.pem` modules as string exports.

**Rationale**: Without this, TypeScript will error on `import rdsCa from './certs/global-bundle.pem'`. The `.d.ts` file tells TypeScript that `.pem` imports resolve to strings.

### Decision 4: Local scripts use `rejectUnauthorized: false`

**Choice**: Update scripts to use `ssl: { rejectUnauthorized: false }` and remove the `NODE_TLS_REJECT_UNAUTHORIZED` environment manipulation blocks.

**Rationale**: User preference — local scripts run from dev machines where full cert verification is unnecessary overhead. Removing the env var block simplifies the scripts while keeping the explicit SSL config.

### Decision 5: Sequelize migrations use CA certificate via `fs.readFileSync`

**Choice**: In `config/config.js`, load the CA bundle at runtime with `fs.readFileSync` and set `rejectUnauthorized: true`.

**Rationale**: Sequelize migrations run via CLI on the deploy machine (not through esbuild), so the `text` loader approach doesn't apply. `fs.readFileSync` with a path relative to `__dirname` is the standard approach for Node.js CLI tools.

## Risks / Trade-offs

- **[CA bundle staleness]** → The `global-bundle.pem` is a static file checked into the repo. If AWS rotates the RDS root CA, the bundle needs manual updating. **Mitigation**: AWS announces CA rotations well in advance (typically 1+ year notice). The global bundle includes overlapping certificates for smooth rotation.
- **[Bundle size increase]** → The `global-bundle.pem` (~200KB) is inlined into each Lambda bundle. **Mitigation**: 200KB × 7 Lambdas is ~1.4MB total, trivial relative to the 250MB Lambda package limit and already-minified bundles.
- **[Migration path mismatch]** → If `config/config.js` references the PEM via a relative path, that path must be valid from wherever migrations are run. **Mitigation**: Use `path.join(__dirname, '../lambda-fns/certs/global-bundle.pem')` which works from the project root.
- **[Local scripts skip verification]** → Scripts use `rejectUnauthorized: false` which doesn't verify the server certificate. **Mitigation**: Acceptable risk since scripts run from trusted dev/deploy machines over VPN or direct networking.
