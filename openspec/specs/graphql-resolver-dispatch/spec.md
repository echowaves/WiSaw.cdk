## ADDED Requirements

### Requirement: One Lambda dispatcher handles GraphQL routing
`lambda-fns/index.ts` dispatches operations by `event.info.fieldName` using `queryHandlers` and `mutationHandlers`.

#### Scenario: Query field dispatch
- **WHEN** fieldName matches a query handler key
- **THEN** dispatcher invokes query resolver with extracted args

#### Scenario: Mutation field dispatch
- **WHEN** fieldName matches a mutation handler key
- **THEN** dispatcher invokes mutation resolver with extracted args

### Requirement: Unknown fields return null
If no handler matches a field name, dispatcher returns `null`.

#### Scenario: Unregistered field
- **WHEN** AppSync invokes field with no registered handler
- **THEN** dispatcher response is null

### Requirement: Handlers use resolver plus getArgs shape
Each entry contains a resolver function and a positional argument extractor.

#### Scenario: New operation registration
- **WHEN** adding a new field implementation
- **THEN** handler entry includes both resolver and getArgs mapping

### Requirement: CDK resolver mappings define AppSync-to-Lambda connections
`lib/resources/resolvers.ts` lists resolver mappings. If mapping exists but dispatcher/schema support is missing, Lambda invocation can still occur and dispatcher returns `null`.

#### Scenario: Missing dispatcher support with existing CDK mapping
- **WHEN** resolver mapping exists but field has no dispatcher handler
- **THEN** Lambda is invoked but result resolves to null

### Requirement: AppSyncEvent arguments are maintained as shared superset typing
The interface is maintained as a pragmatic shared arguments object for existing operations.

#### Scenario: New argument added to operation
- **WHEN** operation introduces new argument
- **THEN** shared event arguments type is updated to include it
