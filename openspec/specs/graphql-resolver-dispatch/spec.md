## ADDED Requirements

### Requirement: One Lambda dispatcher handles GraphQL routing
`lambda-fns/index.ts` dispatches operations by `event.info.fieldName` using `queryHandlers` and `mutationHandlers`.

### Requirement: Unknown fields return null
If no handler matches a field name, dispatcher returns `null`.

### Requirement: Handlers use resolver plus getArgs shape
Each entry contains a resolver function and a positional argument extractor.

### Requirement: CDK resolver mappings define AppSync-to-Lambda connections
`lib/resources/resolvers.ts` lists resolver mappings. If mapping exists but dispatcher/schema support is missing, Lambda invocation can still occur and dispatcher returns `null`.

### Requirement: AppSyncEvent arguments are maintained as shared superset typing
The interface is maintained as a pragmatic shared arguments object for existing operations.
