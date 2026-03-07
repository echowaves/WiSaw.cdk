## Why

The project has 16 feature specs documenting individual capabilities but lacks documentation of the cross-cutting architectural patterns, conventions, and rules that govern how all features are built. New feature development requires reverse-engineering these patterns from existing code. Documenting the architecture ensures consistency, reduces onboarding friction, and creates a reference that AI assistants and developers can use to generate correct, idiomatic code.

## What Changes

- Create a spec defining the single-Lambda dispatcher pattern used to route all GraphQL operations to controller functions
- Create a spec documenting the controller conventions (argument extraction, database lifecycle, model casting, error handling, validation)
- Create a spec documenting the raw SQL + PostGIS database access patterns and the serverless-postgres connection management approach
- Create a spec defining CDK infrastructure conventions (resource organization, resolver wiring, Lambda configuration)
- Create a spec capturing the data model conventions (class-transformer models, UUID strategy, timestamp formatting, S3 URL derivation)

## Capabilities

### New Capabilities
- `graphql-resolver-dispatch`: The single-Lambda dispatcher pattern that routes AppSync events to controller handlers via a handler registry
- `controller-conventions`: Conventions for writing controller functions — argument handling, psql lifecycle (connect/query/clean), model casting, validation, and error handling
- `database-access-patterns`: Raw SQL query patterns, serverless-postgres connection management, PostGIS geo-query conventions, parameterized queries
- `cdk-infrastructure`: CDK stack organization, resource modules, AppSync resolver wiring, Lambda configuration standards, environment variable patterns
- `data-model-conventions`: TypeScript model classes, class-transformer usage, UUID/integer ID duality, timestamp formatting, S3 URL derivation in toJSON()

### Modified Capabilities
_None — these are new cross-cutting architecture specs, not modifications to existing feature specs._

## Impact

- No code changes — this is a documentation-only change
- New specs will be created at `openspec/specs/<name>/spec.md` for each capability above
- These specs serve as guardrails for future feature development and AI-assisted code generation
- Existing feature specs remain unchanged but can reference these architecture specs for shared patterns
