## 1. GraphQL Schema

- [x] 1.1 Add `AppConfig` type with `minAppVersion: String`, `minAppBuild: Int`, `message: String` to `graphql/schema.graphql`
- [x] 1.2 Add `appConfig: AppConfig` field to the `Query` type in `graphql/schema.graphql`

## 2. Lambda Controller

- [x] 2.1 Create `lambda-fns/controllers/appConfig.ts` with env var reads and return object
- [x] 2.2 Controller reads `MIN_APP_VERSION` (default `'1.0.0'`), `MIN_APP_BUILD` (default `0`), `UPDATE_MESSAGE` (default `''`)
- [x] 2.3 Controller returns `{ minAppVersion, minAppBuild, message }`

## 3. Resolver Wiring

- [x] 3.1 Import `appConfig` controller in `lambda-fns/index.ts`
- [x] 3.2 Add `{ type: 'Query', field: 'appConfig', fn: appConfig }` to the resolver mapping array

## 4. Lambda Environment Configuration

- [x] 4.1 Add `MIN_APP_VERSION`, `MIN_APP_BUILD`, `UPDATE_MESSAGE` env vars to the Lambda function config in `lib/resources/lambdas.ts`
- [x] 4.2 Use `process.env.MIN_APP_VERSION ?? '1.0.0'` and `parseInt(process.env.MIN_APP_BUILD ?? '0', 10)` pattern for default values

## 5. Verification

- [x] 5.1 Run `npx cdk deploy` (or equivalent) and verify the Lambda compiles without errors
- [x] 5.2 Test the query returns default values: `{ appConfig: { minAppVersion: "1.0.0", minAppBuild: 0, message: "" } }`
- [x] 5.3 Test with `MIN_APP_BUILD=1234` and verify response reflects the change
- [x] 5.4 Test with `MIN_APP_VERSION=7.0.0` and verify response reflects the change

## 6. Bug Fix: Lambda env vars clobbered by `process.env` override

- [x] 6.1 **Bug**: In `lib/resources/lambdas.ts`, the Lambda environment config spreads `...config` (from `.env.prod`) but then overrides `MIN_APP_VERSION`, `MIN_APP_BUILD`, and `UPDATE_MESSAGE` with `process.env.<VAR> ?? 'default'`. Since `process.env` reads from the **shell**, not the `.env.prod` file, these three vars always fall back to defaults when `DEPLOY_ENV` is not set in the shell. The Lambda returns `{ minAppBuild: 0, minAppVersion: "1.0.0", message: "" }` regardless of `.env.prod` values.
- [x] 6.2 **Root cause**: `...config` correctly loads values from `.env.prod` via `config/config.js`, but the subsequent explicit assignments use `process.env` which takes precedence and has no shell values set.
- [x] 6.3 **Fix**: Replace `process.env.MIN_APP_VERSION`, `process.env.MIN_APP_BUILD`, `process.env.UPDATE_MESSAGE` with `config.MIN_APP_VERSION`, `config.MIN_APP_BUILD`, `config.UPDATE_MESSAGE` in `lib/resources/lambdas.ts` so the overrides read from the same `.env.prod` source instead of the shell environment.
- [x] 6.4 **Verification**: After fix, `DEPLOY_ENV=prod npx cdk deploy` injects `MIN_APP_BUILD: '706'` (or whatever value is in `.env.prod`) into the Lambda environment, and the `appConfig` query returns the correct thresholds.
