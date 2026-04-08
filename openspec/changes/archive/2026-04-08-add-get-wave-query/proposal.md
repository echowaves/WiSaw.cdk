## Why

The backend has no read-only way to fetch a single wave's settings. Clients currently rely on mutations or list queries to obtain wave details, which either trigger unintended side effects or return more data than needed. A dedicated `getWave` query lets clients load a specific wave's configuration without mutating state.

## What Changes

- Add a `getWave(waveUuid: String!)` query to the GraphQL schema that returns a single `Wave` object
- Create a new controller that fetches the wave by UUID, attaches the caller's role and recent photos, and returns the result — with no writes or side effects
- Wire the query through the dispatcher and CDK resolver mapping

## Capabilities

### New Capabilities
- `get-wave`: A read-only GraphQL query to fetch a single wave by UUID, returning its settings, the caller's membership role, and recent photos

### Modified Capabilities

_None — this adds a new query without changing existing behaviour._

## Impact

- **GraphQL schema** (`graphql/schema.graphql`): new `getWave` field on `Query`
- **Controller** (`lambda-fns/controllers/waves/getWave.ts`): new file
- **Dispatcher** (`lambda-fns/index.ts`): new entry in `queryHandlers`
- **CDK resolvers** (`lib/resources/resolvers.ts`): new resolver mapping entry
- No database migrations required — uses existing tables and indexes
- No breaking changes to existing queries or mutations
