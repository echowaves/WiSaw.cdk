## Why

Dependencies have accumulated version drift since the last update. Several packages have minor/patch releases with bug fixes and security patches; two packages (`eslint` v9→v10, `nyc` v17→v18) have major releases that may require configuration adjustments. Keeping dependencies current reduces the attack surface and ensures compatibility with the broader ecosystem.

## What Changes

- Update all outdated npm dependencies to their latest published exact versions
- No new capabilities are added; no existing API or behavioral contracts change
- **BREAKING** (tooling only): `eslint` 9 → 10 — ESLint v10 drops some legacy APIs and config file formats; ESLint config (`eslint.config.*`) must be verified for compatibility
- **BREAKING** (tooling only): `nyc` 17 → 18 — v18 may change CLI flags or reporter output; test scripts must be verified

## Capabilities

### New Capabilities

_(none — this is a maintenance upgrade with no new user-facing or API capabilities)_

### Modified Capabilities

_(none — no behavioral requirements change as a result of this upgrade)_

## Impact

- `package.json` — all outdated dependency versions updated to exact latest
- `node_modules/` — reinstalled after version bump
- ESLint configuration — must be verified against ESLint v10 breaking changes
- Test scripts in `package.json` — `nyc` CLI usage must be verified against v18
- CDK deployments — `aws-cdk` + `aws-cdk-lib` minor bump (2.1032→2.1109 / 2.225→2.241); CDK constructs API is backward-compatible within minor versions

### Packages being updated

| Package | Current | Latest | Type |
|---|---|---|---|
| `@aws-sdk/client-lambda` | 3.933.0 | 3.1003.0 | dep |
| `@aws-sdk/client-rekognition` | 3.933.0 | 3.1003.0 | dep |
| `@aws-sdk/client-s3` | 3.933.0 | 3.1003.0 | dep |
| `@aws-sdk/client-sso-oidc` | 3.933.0 | 3.1003.0 | dep |
| `@aws-sdk/client-sts` | 3.933.0 | 3.1003.0 | dep |
| `@aws-sdk/s3-request-presigner` | 3.933.0 | 3.1003.0 | dep |
| `aws-cdk-lib` | 2.225.0 | 2.241.0 | dep |
| `constructs` | 10.4.3 | 10.5.1 | dep |
| `sitemap` | 9.0.0 | 9.0.1 | dep |
| `@babel/cli` | 7.28.3 | 7.28.6 | devDep |
| `@babel/core` | 7.28.5 | 7.29.0 | devDep |
| `@babel/preset-env` | 7.28.5 | 7.29.0 | devDep |
| `@babel/register` | 7.28.3 | 7.28.6 | devDep |
| `@types/node` | 24.10.1 | 25.3.4 | devDep |
| `@typescript-eslint/eslint-plugin` | 8.47.0 | 8.56.1 | devDep |
| `@typescript-eslint/parser` | 8.47.0 | 8.56.1 | devDep |
| `aws-cdk` | 2.1032.0 | 2.1109.0 | devDep |
| `chai` | 6.2.1 | 6.2.2 | devDep |
| `dotenv` | 17.2.3 | 17.3.1 | devDep |
| `esbuild` | 0.27.0 | 0.27.3 | devDep |
| `eslint` | 9.39.1 | 10.0.2 | devDep ⚠️ MAJOR |
| `eslint-plugin-n` | 17.23.1 | 17.24.0 | devDep |
| `nyc` | 17.1.0 | 18.0.0 | devDep ⚠️ MAJOR |
| `pg` | 8.16.3 | 8.20.0 | devDep |
| `sequelize-cli` | 6.6.3 | 6.6.5 | devDep |
| `supertest` | 7.1.4 | 7.2.2 | devDep |
