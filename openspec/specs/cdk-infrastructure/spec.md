## ADDED Requirements

### Requirement: CDK stack is organized into resource modules
The main stack class (`WiSawCdkStack` in `lib/wi_saw.cdk-stack.ts`) SHALL delegate resource creation to separate module functions in `lib/resources/`. Each resource module SHALL export a function that takes the scope (Construct) and configuration as parameters.

#### Scenario: Stack constructor composition
- **WHEN** the CDK stack is instantiated
- **THEN** it SHALL call `createDatabase()`, `createAppSyncApi()`, `createLambdas()`, `createBuckets()`, `createCloudFront()`, and `createResolvers()` in sequence, passing the stack as scope

### Requirement: Resource module naming convention
Each resource module SHALL be a TypeScript file in `lib/resources/` named after the AWS service or concept it manages (e.g., `app-sync.ts`, `lambdas.ts`, `buckets.ts`, `cloud-front.ts`, `database.ts`, `resolvers.ts`). Each SHALL export a single function prefixed with `create` (e.g., `createAppSyncApi`, `createLambdas`).

#### Scenario: Adding a new resource type
- **WHEN** a new AWS resource type is needed
- **THEN** it SHALL be defined in a new file at `lib/resources/<resource-name>.ts` exporting a `create<ResourceName>()` function

### Requirement: Environment-prefixed resource naming
All CDK construct IDs and resource names SHALL be prefixed with the deployment environment string (obtained from `deployEnv()` in `lib/utilities/config.ts`). This enables multiple environments (dev, staging, prod) to coexist in the same AWS account.

#### Scenario: Lambda function naming
- **WHEN** a Lambda function construct is created
- **THEN** its construct ID SHALL follow the pattern `` `${deployEnv()}-<descriptive-name>` `` or `` `${deployEnv()}_<descriptive-name>` ``

#### Scenario: AppSync API naming
- **WHEN** the AppSync API is created
- **THEN** its name SHALL follow the pattern `` `${deployEnv()}-cdk-wisaw-appsync-api` ``

### Requirement: All GraphQL resolvers route through a single Lambda data source
The stack SHALL create a single Lambda data source from the main handler function (`wisawFn`) and wire all GraphQL Query and Mutation fields to it. There SHALL be no request/response mapping templates; all operations use direct Lambda invocation.

#### Scenario: Resolver wiring
- **WHEN** resolvers are created
- **THEN** `createResolvers()` SHALL iterate over a flat array of `{ typeName, fieldName }` objects and call `lambdaDs.createResolver()` for each, using the construct ID pattern `` `${typeName}-${fieldName}-Resolver` ``

### Requirement: Main handler Lambda uses NodejsFunction with specific configuration
The main GraphQL handler Lambda (`wisawFn`) SHALL be created as a `NodejsFunction` with: runtime Node.js 22.x, entry point `lambda-fns/index.ts`, handler `main`, bundling with minification and inline source maps (target es2020), memory 10240 MB, timeout 30 seconds, and Lambda Insights layer attached.

#### Scenario: Main Lambda configuration
- **WHEN** the main handler Lambda is defined
- **THEN** it SHALL use `NodejsFunction` with `runtime: NODEJS_22_X`, `handler: 'main'`, `memorySize: 10240`, `timeout: 30s`, and bundling options `{ minify: true, target: 'es2020', sourceMap: true, sourceMapMode: INLINE }`

### Requirement: Image processing Lambdas use sharp layer
Image processing Lambda functions (processUploadedImage, processUploadedPrivateImage) SHALL include the `sharp` library via a Lambda Layer (not bundled) and SHALL declare `sharp` as an external module in bundling configuration.

#### Scenario: Image processing Lambda bundling
- **WHEN** an image processing Lambda is defined
- **THEN** its bundling config SHALL include `externalModules: ['sharp']` and it SHALL attach the sharp Lambda Layer ARN

### Requirement: Lambda@Edge functions use CloudFront EdgeFunction construct
Lambda functions executed at CloudFront edge locations (meta tag injection, URL redirection) SHALL use `cloudfront.experimental.EdgeFunction` rather than standard `lambda.Function`. These functions SHALL have lower memory (128 MB) and shorter timeouts (5 seconds).

#### Scenario: Edge function definition
- **WHEN** a Lambda@Edge function is created for CloudFront
- **THEN** it SHALL use `cloudfront.experimental.EdgeFunction` with `memorySize: 128` and `timeout: 5s`

### Requirement: Scheduled Lambdas use EventBridge rules
Lambdas that run on a schedule (cleanup abuse reports, generate site map) SHALL be triggered by EventBridge `Rule` constructs with `Schedule.rate()` durations. The schedule target SHALL use a `LambdaFunction` event target.

#### Scenario: Scheduled cleanup Lambda
- **WHEN** the abuse report cleanup Lambda is defined
- **THEN** it SHALL have an EventBridge rule with `Schedule.rate(cdk.Duration.hours(24))`

### Requirement: Production-only resources are conditionally created
Resources specific to the production environment (site map generation, Lambda@Edge functions for SEO) SHALL only be created when `deployEnv() === 'prod'`. Non-production deployments SHALL skip these resources.

#### Scenario: Site map Lambda in production
- **WHEN** the deployment environment is `prod`
- **THEN** the `generateSiteMapLambdaFunction` and Lambda@Edge functions SHALL be created

#### Scenario: Site map Lambda in non-production
- **WHEN** the deployment environment is not `prod`
- **THEN** the `generateSiteMapLambdaFunction` and Lambda@Edge functions SHALL NOT be created

### Requirement: Each Lambda has a dedicated log group with 1-day retention
Every Lambda function SHALL have an explicitly created `logs.LogGroup` with `retention: ONE_DAY` and `removalPolicy: DESTROY`. The log group SHALL be passed to the Lambda's `logGroup` property.

#### Scenario: Log group for main handler
- **WHEN** the main handler Lambda is created
- **THEN** a `LogGroup` SHALL be created with `logGroupName: /aws/lambda/${deployEnv()}-cdk-wisaw-fn` and `retention: ONE_DAY`

### Requirement: AppSync uses API key authentication with yearly expiration
The AppSync GraphQL API SHALL use `API_KEY` as the default authorization type with key expiration set to 365 days. X-Ray tracing SHALL be enabled.

#### Scenario: API authentication configuration
- **WHEN** the AppSync API is created
- **THEN** it SHALL configure `authorizationType: API_KEY` with `expires: cdk.Expiration.after(cdk.Duration.days(365))` and `xrayEnabled: true`

### Requirement: Configuration is externalized through config module
Lambda environment variables and database connection details SHALL be sourced from `lib/utilities/config.ts` which reads from `config/config.js`. The configuration object SHALL be spread into Lambda environment variables via `environment: { ...config }`.

#### Scenario: Lambda environment variables
- **WHEN** a Lambda function is created
- **THEN** its environment SHALL be set to `{ ...config }` where config contains database credentials, S3 bucket names, and other runtime settings
