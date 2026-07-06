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
