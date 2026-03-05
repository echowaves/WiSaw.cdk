## 1. Update package.json versions

- [ ] 1.1 Update `@aws-sdk/client-lambda` from `3.933.0` to `3.1003.0`
- [ ] 1.2 Update `@aws-sdk/client-rekognition` from `3.933.0` to `3.1003.0`
- [ ] 1.3 Update `@aws-sdk/client-s3` from `3.933.0` to `3.1003.0`
- [ ] 1.4 Update `@aws-sdk/client-sso-oidc` from `3.933.0` to `3.1003.0`
- [ ] 1.5 Update `@aws-sdk/client-sts` from `3.933.0` to `3.1003.0`
- [ ] 1.6 Update `@aws-sdk/s3-request-presigner` from `3.933.0` to `3.1003.0`
- [ ] 1.7 Update `aws-cdk-lib` from `2.225.0` to `2.241.0`
- [ ] 1.8 Update `constructs` from `10.4.3` to `10.5.1`
- [ ] 1.9 Update `sitemap` from `9.0.0` to `9.0.1`
- [ ] 1.10 Update `@babel/cli` from `7.28.3` to `7.28.6`
- [ ] 1.11 Update `@babel/core` from `7.28.5` to `7.29.0`
- [ ] 1.12 Update `@babel/preset-env` from `7.28.5` to `7.29.0`
- [ ] 1.13 Update `@babel/register` from `7.28.3` to `7.28.6`
- [ ] 1.14 Update `@types/node` from `24.10.1` to `25.3.4`
- [ ] 1.15 Update `@typescript-eslint/eslint-plugin` from `8.47.0` to `8.56.1`
- [ ] 1.16 Update `@typescript-eslint/parser` from `8.47.0` to `8.56.1`
- [ ] 1.17 Update `aws-cdk` from `2.1032.0` to `2.1109.0`
- [ ] 1.18 Update `chai` from `6.2.1` to `6.2.2`
- [ ] 1.19 Update `dotenv` from `17.2.3` to `17.3.1`
- [ ] 1.20 Update `esbuild` from `0.27.0` to `0.27.3`
- [ ] 1.21 Update `eslint` from `9.39.1` to `10.0.2`
- [ ] 1.22 Update `eslint-plugin-n` from `17.23.1` to `17.24.0`
- [ ] 1.23 Update `nyc` from `17.1.0` to `18.0.0`
- [ ] 1.24 Update `pg` from `8.16.3` to `8.20.0`
- [ ] 1.25 Update `sequelize-cli` from `6.6.3` to `6.6.5`
- [ ] 1.26 Update `supertest` from `7.1.4` to `7.2.2`

## 2. Install and verify

- [ ] 2.1 Run `npm install` to apply all version changes and regenerate `package-lock.json`
- [ ] 2.2 Run `npx tsc --noEmit` and confirm zero TypeScript errors
- [ ] 2.3 Run `npm run lint` and confirm ESLint v10 passes cleanly; if `ts-standard` is incompatible revert `eslint` to `9.39.1`
- [ ] 2.4 Run `npm test` and confirm all tests pass; if `nyc` v18 CLI path changed, update the `test` script in `package.json` accordingly
