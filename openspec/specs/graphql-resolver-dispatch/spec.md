## ADDED Requirements

### Requirement: Single Lambda dispatcher routes all GraphQL operations
The system SHALL use a single Lambda function (`lambda-fns/index.ts`) as the entry point for all AppSync GraphQL queries and mutations. The function SHALL export a `main` handler that receives an `AppSyncEvent` and dispatches to the appropriate controller function.

#### Scenario: Query operation dispatched
- **WHEN** AppSync invokes the Lambda with `event.info.fieldName` matching a key in `queryHandlers`
- **THEN** the system SHALL call the corresponding handler's `resolver` function with arguments extracted by `getArgs`

#### Scenario: Mutation operation dispatched
- **WHEN** AppSync invokes the Lambda with `event.info.fieldName` matching a key in `mutationHandlers`
- **THEN** the system SHALL call the corresponding handler's `resolver` function with arguments extracted by `getArgs`

#### Scenario: Unknown field name
- **WHEN** AppSync invokes the Lambda with a `fieldName` not present in either `queryHandlers` or `mutationHandlers`
- **THEN** the system SHALL return `null`

### Requirement: Handler registry uses HandlerDefinition interface
Each entry in `queryHandlers` and `mutationHandlers` SHALL conform to the `HandlerDefinition` interface, which defines two properties: `resolver` (an async function returning a Promise) and `getArgs` (a function that extracts and orders arguments from the AppSync event's `arguments` object).

#### Scenario: New query handler registered
- **WHEN** a new GraphQL query is added
- **THEN** a corresponding entry SHALL be added to the `queryHandlers` record with a `resolver` pointing to the controller function and a `getArgs` that extracts the relevant arguments from `AppSyncEvent['arguments']`

#### Scenario: New mutation handler registered
- **WHEN** a new GraphQL mutation is added
- **THEN** a corresponding entry SHALL be added to the `mutationHandlers` record following the same `HandlerDefinition` pattern

### Requirement: Queries and mutations are separated into distinct registries
The dispatcher SHALL maintain two separate `Record<string, HandlerDefinition>` maps: `queryHandlers` for Query type fields and `mutationHandlers` for Mutation type fields. Lookup SHALL check `queryHandlers` first, then fall back to `mutationHandlers` using the nullish coalescing operator (`??`).

#### Scenario: Handler lookup order
- **WHEN** the dispatcher receives an event
- **THEN** it SHALL look up `queryHandlers[event.info.fieldName]` first, and only if that is `undefined`, look up `mutationHandlers[event.info.fieldName]`

### Requirement: Controller functions are imported from domain-organized directories
Each handler's `resolver` SHALL be an imported default export from a controller file located under `lambda-fns/controllers/<domain>/`. Domains include `photos`, `comments`, `waves`, `friendships`, `messages`, `secrets`, `abuseReports`, and `contactForms`.

#### Scenario: Controller file location for a photo mutation
- **WHEN** the `createPhoto` mutation handler is defined
- **THEN** its resolver SHALL import from `./controllers/photos/create`

#### Scenario: Controller file location for a wave query
- **WHEN** the `listWaves` query handler is defined
- **THEN** its resolver SHALL import from `./controllers/waves/listWaves`

### Requirement: AppSyncEvent interface defines all possible arguments
The dispatcher SHALL define an `AppSyncEvent` interface with `info.fieldName` (string) and `arguments` (an object containing all possible GraphQL argument names as optional typed properties). This flat argument object is shared across all operations.

#### Scenario: Arguments interface covers all GraphQL fields
- **WHEN** a new GraphQL operation introduces a new argument
- **THEN** the argument SHALL be added as a property to `AppSyncEvent['arguments']` with the appropriate TypeScript type

### Requirement: AppSync resolver mapping must be registered in CDK
Every GraphQL query and mutation field that is handled by the Lambda dispatcher SHALL have a corresponding `{ typeName, fieldName }` entry in the resolver fields array in `lib/resources/resolvers.ts`. The `createResolvers` function iterates this array and calls `lambdaDs.createResolver()` for each entry, which creates the AppSync resolver mapping that connects the GraphQL field to the Lambda data source. Without this entry, AppSync will not invoke the Lambda for that field, even if the handler is registered in `lambda-fns/index.ts`.

#### Scenario: New query resolver registered in CDK
- **WHEN** a new GraphQL query is added to `graphql/schema.graphql` and a handler is registered in `queryHandlers`
- **THEN** a corresponding `{ typeName: 'Query', fieldName: '<fieldName>' }` entry SHALL be added to the fields array in `lib/resources/resolvers.ts`

#### Scenario: New mutation resolver registered in CDK
- **WHEN** a new GraphQL mutation is added to `graphql/schema.graphql` and a handler is registered in `mutationHandlers`
- **THEN** a corresponding `{ typeName: 'Mutation', fieldName: '<fieldName>' }` entry SHALL be added to the fields array in `lib/resources/resolvers.ts`

#### Scenario: Missing CDK resolver mapping
- **WHEN** a handler exists in `lambda-fns/index.ts` but no corresponding entry exists in `lib/resources/resolvers.ts`
- **THEN** AppSync will NOT invoke the Lambda for that field, and the operation will fail silently or return null to the client
