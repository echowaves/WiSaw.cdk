## MODIFIED Requirements

### Requirement: Main handler Lambda uses NodejsFunction with specific configuration
The main GraphQL handler Lambda (`wisawFn`) SHALL be created as a `NodejsFunction` with: runtime Node.js 22.x, entry point `lambda-fns/index.ts`, handler `main`, bundling with minification and inline source maps (target es2020), memory 10240 MB, and timeout 30 seconds. Lambda Insights SHALL NOT be attached.

#### Scenario: Main Lambda configuration
- **WHEN** the main handler Lambda is defined
- **THEN** it SHALL use `NodejsFunction` with `runtime: NODEJS_22_X`, `handler: 'main'`, `memorySize: 10240`, `timeout: 30s`, and bundling options `{ minify: true, target: 'es2020', sourceMap: true, sourceMapMode: INLINE }`

#### Scenario: No Lambda Insights extension
- **WHEN** any Lambda function is defined
- **THEN** it SHALL NOT include the `insightsVersion` property or any Lambda Insights layer
