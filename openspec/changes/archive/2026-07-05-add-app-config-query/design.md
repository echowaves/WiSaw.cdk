## Context

The app is a React Native client communicating with an AppSync GraphQL API backed by Lambda functions. Currently there is no mechanism for the backend to instruct the frontend to force-update before continuing. The deploy pipeline (EAS Update → `eas update --branch production`) controls the JS bundle, but the frontend has no way to discover whether the new bundle requires an update.

AppSync auth is API Key only (`appsync.AuthorizationType.API_KEY`), and all existing queries follow the same pattern: schema-first at `graphql/schema.graphql`, controller at `lambda-fns/controllers/<field>.ts`, resolver mapping in `lambda-fns/index.ts`.

## Goals / Non-Goals

**Goals:**
- Provide a single GraphQL query `appConfig` that returns force-update state.
- The frontend calls it at startup and on foreground to decide whether to show an update overlay.
- Zero-latency — no DB connection, just env var reads.
- Consistent with existing patterns (API key auth, no new CDK resources).

**Non-Goals:**
- No dynamic runtime toggle without CDK deploy.
- No DB table, no migration, no new CDK resource.
- No frontend changes (separate repo).
- No version comparison logic on the backend.

## Decisions

### 1. Env vars instead of a DB table

**Decision**: Read `MIN_APP_VERSION`, `MIN_APP_BUILD` from environment variables.

**Rationale**: Force-updates are rare (maybe twice a year). The deploy pipeline already sets build metadata. A DB table adds latency (cold start + connection pool + query) for a feature that reads the same values for all clients during a cold container's lifetime.

**Alternatives considered:**
- SSM Parameter Store — adds latency, enables runtime toggle (unnecessary for current use case).
- DynamoDB — similar to env vars in terms of read path, adds a dependency and cost for zero benefit here.

### 2. `minAppVersion` is `String`, `minAppBuild` is `Int`

**Decision**: Version as semver string (frontend compares), build as integer.

**Rationale**: The app maintains version parity between iOS and Android (App Store releases). Build numbers increment per hot redeploy via EAS Update. Two distinct upgrade paths:
- Version change → App Store update required
- Build change → App restart required (reload JS bundle)

The backend has no semver library, so version comparison happens on the frontend.

### 3. Frontend decides which threshold triggered

**Decision**: The server returns raw thresholds (`minAppVersion`, `minAppBuild`); the frontend compares against its current version/build and decides what action to take.

**Rationale**: The frontend knows its own current version/build. When both thresholds fire, version takes precedence. The frontend also decides the exact message to display based on which threshold triggered.

### 4. `message` defaults to empty string, not null

**Decision**: `message: String` with default `''` when not set.

**Rationale**: An empty string is a clearer "no message" signal than GraphQL null. The frontend can check `message.length > 0` to decide whether to render it.

### 5. Env vars evaluated at module load, not per-request

**Decision**: The controller reads env vars at the top level (module scope), not inside the function body.

**Rationale**: With provisioned concurrency, a Lambda container might serve many requests. Locking the values at container boot ensures consistency — you don't want thresholds flipping mid-request. This is correct behavior for force-update.

### 6. Lambda env var injection in `lib/resources/lambdas.ts`

**Decision**: Add env vars to the existing Lambda function config in `lib/resources/lambdas.ts`, following the pattern of `DEEP_LINK_BASE_URL`.

**Rationale**: This is where all Lambda env vars are defined. No new CDK resource needed.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Env var typo in production causes unexpected force-update | Add validation in controller or CDK synth to warn on non-semver `MIN_APP_VERSION` or non-integer `MIN_APP_BUILD` |
| Cold-start Lambda reads stale env vars if container persists across deploys | Not a real risk — CDK deploy replaces the Lambda, new env vars are injected |
| Frontend doesn't call `appConfig` at startup | Document in the frontend repo when the change is implemented there |
| `message` is very long and bloats the GraphQL response | The response is tiny (~100 bytes max). No concern. |
| Both thresholds fire simultaneously | Frontend decides: version takes precedence over build |

## Migration Plan

1. Add env vars to Lambda config in CDK (zero-impact on existing traffic).
2. Add schema type and query field.
3. Add controller + resolver mapping.
4. `DEPLOY_ENV=prod npx cdk deploy` — new query is live, returns default values (no force-update active).
5. When a force-update is needed: set `FORCE_UPDATE=true` and `UPDATE_MESSAGE` in the Lambda env, then `DEPLOY_ENV=prod npx cdk deploy` again.
