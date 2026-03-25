## ADDED Requirements

### Requirement: Trace logging utility
The system SHALL provide a trace logging utility module at `lambda-fns/utilities/trace.ts` that emits structured trace log lines to `console.log` with a `[TRACE]` prefix.

#### Scenario: Trace log emitted when enabled
- **WHEN** `TRACE_LOG_ENABLED` environment variable is set to `'true'`
- **THEN** calls to `traceLog(label, data)` SHALL write a line to `console.log` in the format `[TRACE] <label> | <key=value pairs>`

#### Scenario: Trace log suppressed when disabled
- **WHEN** `TRACE_LOG_ENABLED` environment variable is absent, empty, or set to any value other than `'true'`
- **THEN** calls to `traceLog()` SHALL produce no output and perform no string formatting

### Requirement: Lambda handler entry/exit tracing
The system SHALL log trace entries at the start and end of every Lambda handler invocation, including the GraphQL resolver dispatcher (`lambda-fns/index.ts`) and all standalone Lambda handlers under `lambda-fns/lambdas/`.

#### Scenario: GraphQL resolver trace
- **WHEN** `TRACE_LOG_ENABLED` is `'true'` and a GraphQL operation is invoked
- **THEN** the handler SHALL emit a `handler:START` trace log with the `fieldName` at entry and a `handler:END` trace log with `fieldName` and `duration` in milliseconds at exit

#### Scenario: Standalone Lambda trace
- **WHEN** `TRACE_LOG_ENABLED` is `'true'` and a standalone Lambda handler is invoked
- **THEN** the handler SHALL emit a `<lambdaName>:START` trace log at entry and a `<lambdaName>:END` trace log with `duration` in milliseconds at exit

#### Scenario: Tracing does not affect handler behavior
- **WHEN** trace logging is enabled or disabled
- **THEN** the handler SHALL return the same result and throw the same errors as it would without tracing

### Requirement: Database query tracing
The system SHALL log trace entries around every call to `ManagedServerlessClient.query()`, `connect()`, and `clean()` in `lambda-fns/psql.ts`.

#### Scenario: Query start and end traced
- **WHEN** `TRACE_LOG_ENABLED` is `'true'` and `psql.query()` is called
- **THEN** the system SHALL emit a `psql.query:START` trace log containing the first 200 characters of the query text, and a `psql.query:END` trace log containing the duration in milliseconds and row count

#### Scenario: Connect and clean traced
- **WHEN** `TRACE_LOG_ENABLED` is `'true'` and `psql.connect()` or `psql.clean()` is called
- **THEN** the system SHALL emit corresponding `psql.connect:START/END` and `psql.clean:START/END` trace logs with duration

### Requirement: Environment variable configuration
The `TRACE_LOG_ENABLED` environment variable SHALL be passed to all Lambda functions via the CDK stack configuration.

#### Scenario: Env var available in all Lambdas
- **WHEN** the CDK stack is deployed
- **THEN** every Lambda function (GraphQL resolver and all standalone Lambdas) SHALL have `TRACE_LOG_ENABLED` available in `process.env`

#### Scenario: Default value is disabled
- **WHEN** `TRACE_LOG_ENABLED` is not explicitly set in the environment config
- **THEN** trace logging SHALL be disabled (no trace output)
