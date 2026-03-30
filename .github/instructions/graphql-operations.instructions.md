---
    description: Checklist for adding or modifying GraphQL queries and mutations
    applyTo: 'graphql/schema.graphql,lambda-fns/index.ts,lib/resources/resolvers.ts,lambda-fns/controllers/**'
---
# GraphQL Operation Checklist

When adding a new GraphQL query or mutation, ALL FOUR of these files must be updated:

1. **GraphQL schema** (`graphql/schema.graphql`) — Add the field to `type Query` or `type Mutation`
2. **Controller** (`lambda-fns/controllers/<domain>/<name>.ts`) — Create the handler function
3. **Dispatcher** (`lambda-fns/index.ts`) — Add import + entry in `queryHandlers` or `mutationHandlers`
4. **CDK resolver mapping** (`lib/resources/resolvers.ts`) — Add `{ typeName: 'Query'|'Mutation', fieldName: '<name>' }` to the fields array

**CRITICAL**: Missing the resolver entry in `lib/resources/resolvers.ts` causes AppSync to return `null` for the field silently. The Lambda is never invoked. This is the most commonly missed step.

## Verification
After adding a new operation, confirm the field name appears in ALL FOUR files. A mismatch between any of them will cause runtime failures.
