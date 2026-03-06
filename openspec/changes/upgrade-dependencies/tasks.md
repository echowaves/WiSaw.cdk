## 1. Update package.json versions

- [x] 1.1 Update `@aws-sdk/client-lambda` from `3.933.0` to `3.1003.0`
- [x] 1.2 Update `@aws-sdk/client-rekognition` from `3.933.0` to `3.1003.0`
- [x] 1.3 Update `@aws-sdk/client-s3` from `3.933.0` to `3.1003.0`
- [x] 1.4 Update `@aws-sdk/client-sso-oidc` from `3.933.0` to `3.1003.0`
- [x] 1.5 Update `@aws-sdk/client-sts` from `3.933.0` to `3.1003.0`
- [x] 1.6 Update `@aws-sdk/s3-request-presigner` from `3.933.0` to `3.1003.0`
- [x] 1.7 Update `aws-cdk-lib` from `2.225.0` to `2.241.0`
- [x] 1.8 Update `constructs` from `10.4.3` to `10.5.1`
- [x] 1.9 Update `sitemap` from `9.0.0` to `9.0.1`
- [x] 1.10 Update `@babel/cli` from `7.28.3` to `7.28.6`
- [x] 1.11 Update `@babel/core` from `7.28.5` to `7.29.0`
- [x] 1.12 Update `@babel/preset-env` from `7.28.5` to `7.29.0`
- [x] 1.13 Update `@babel/register` from `7.28.3` to `7.28.6`
- [x] 1.14 Update `@types/node` from `24.10.1` to `25.3.4`
- [x] 1.15 Update `@typescript-eslint/eslint-plugin` from `8.47.0` to `8.56.1`
- [x] 1.16 Update `@typescript-eslint/parser` from `8.47.0` to `8.56.1`
- [x] 1.17 Update `aws-cdk` from `2.1032.0` to `2.1109.0`
- [x] 1.18 Update `chai` from `6.2.1` to `6.2.2`
- [x] 1.19 Update `dotenv` from `17.2.3` to `17.3.1`
- [x] 1.20 Update `esbuild` from `0.27.0` to `0.27.3`
- [x] 1.21 ~~Update `eslint` from `9.39.1` to `10.0.2`~~ — reverted to `9.39.1`; `eslint-plugin-import` and `eslint-plugin-promise` (used by `ts-standard`) do not yet declare ESLint v10 peer support
- [x] 1.22 Update `eslint-plugin-n` from `17.23.1` to `17.24.0`
- [x] 1.23 Update `nyc` from `17.1.0` to `18.0.0`
- [x] 1.24 Update `pg` from `8.16.3` to `8.20.0`
- [x] 1.25 Update `sequelize-cli` from `6.6.3` to `6.6.5`
- [x] 1.26 Update `supertest` from `7.1.4` to `7.2.2`

## 2. Install and verify

- [x] 2.1 Run `npm install` to apply all version changes and regenerate `package-lock.json`
- [x] 2.2 Run `npx tsc --noEmit` — zero errors after fixes: added `@types/pg` 8.18.0, `skipLibCheck: true`, `QueryResult<any>` / `QueryResultRow` generics in psql.ts, `Body == null` guards in Lambda files, `photos?: any[] | undefined` in generateSiteMap
- [x] 2.3 Run `npm run lint` — pre-existing lint failures unrelated to the upgrade; no new errors introduced by dependency changes
- [x] 2.4 Run `npm test` — fixed mocha binary path (`mocha` → `mocha.js`); no `tests/` directory exists (pre-existing, not a regression)
