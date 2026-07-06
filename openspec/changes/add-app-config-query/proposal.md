## Why

The app needs a mechanism to enforce force-updates — when a critical fix or hotfix is deployed via EAS Update, the frontend must know to block the user until they reload. A GraphQL query the app calls at startup and on foreground is the natural hook for this.

## What Changes

- Add GraphQL type `AppConfig` with fields `minAppVersion` (String), `minAppBuild` (Int), and `message` (String).
- Add query field `appConfig` to the root `Query` type.
- Create Lambda controller `lambda-fns/controllers/appConfig.ts` that reads values from environment variables.
- Wire the new resolver mapping in `lambda-fns/index.ts`.
- Add `MIN_APP_VERSION`, `MIN_APP_BUILD` env vars to the Lambda configuration in `lib/resources/lambdas.ts`.

## Capabilities

### New Capabilities

- `app-config`: Force-update mechanism via `appConfig` GraphQL query, driven by env vars with no DB dependency.

### Modified Capabilities

<!-- None — no existing spec requirements change. -->

## Impact

- **Code**: `graphql/schema.graphql`, `lambda-fns/controllers/appConfig.ts` (new), `lambda-fns/index.ts`, `lib/resources/lambdas.ts`
- **Frontend**: Calls `appConfig` at startup and on foreground; compares current version/build against server thresholds; shows appropriate message. App version takes precedence over build when both trigger.
- **API**: New query field on AppSync, same API key auth — no breaking changes
- **Dependencies**: None — no new packages
- **Systems**: AWS Lambda function (same one), AppSync resolver mapping only
