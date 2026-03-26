## ADDED Requirements

### Requirement: Lambda deployments bundle the AWS RDS CA certificate
All Lambda functions that connect to RDS SHALL include the AWS RDS global CA bundle (`global-bundle.pem`) inlined at build time via esbuild's `text` loader. The CA bundle file SHALL be stored at `lambda-fns/certs/global-bundle.pem` and imported as a string constant in `psql.ts`.

#### Scenario: esbuild bundles the PEM file as text
- **WHEN** `cdk deploy` runs esbuild for any `NodejsFunction`
- **THEN** the `.pem` file SHALL be resolved by the `text` loader and inlined as a string constant in the output bundle

#### Scenario: All 7 NodejsFunction definitions include the PEM loader
- **WHEN** any `NodejsFunction` in `lib/resources/lambdas.ts` is bundled
- **THEN** its `bundling.loader` config SHALL include `{ '.pem': 'text' }`

#### Scenario: TypeScript accepts PEM imports
- **WHEN** `psql.ts` imports `global-bundle.pem`
- **THEN** a TypeScript declaration file (`lambda-fns/certs/pem.d.ts`) SHALL declare `*.pem` modules as default-exporting strings, preventing compilation errors

### Requirement: Lambda PostgreSQL connections verify the RDS server certificate
The `psql` singleton SHALL connect to RDS with full TLS certificate verification using the bundled CA certificate. The connection SHALL reject any server certificate not signed by a trusted CA in the bundle.

#### Scenario: psql uses CA certificate for TLS verification
- **WHEN** the `ManagedServerlessClient` singleton is created in `psql.ts`
- **THEN** the SSL config SHALL be `{ ca: rdsCa, rejectUnauthorized: true }` where `rdsCa` is the imported global CA bundle string

#### Scenario: Connection to RDS with valid certificate succeeds
- **WHEN** a Lambda connects to an RDS instance presenting a certificate signed by a CA in `global-bundle.pem`
- **THEN** the TLS handshake SHALL succeed and queries SHALL execute normally

#### Scenario: Connection to a server with an untrusted certificate fails
- **WHEN** a Lambda attempts to connect to a server presenting a certificate NOT signed by a CA in the bundle
- **THEN** the TLS handshake SHALL fail with a certificate verification error

### Requirement: NODE_TLS_REJECT_UNAUTHORIZED is not used
The `NODE_TLS_REJECT_UNAUTHORIZED` environment variable SHALL NOT be set in any `.env.*` file or Lambda environment configuration. TLS verification SHALL be controlled exclusively through the `ssl` configuration object in the database client.

#### Scenario: Environment files do not contain NODE_TLS_REJECT_UNAUTHORIZED
- **WHEN** a developer reviews `.env.sample`, `.env.test`, or `.env.prod`
- **THEN** none of these files SHALL contain a `NODE_TLS_REJECT_UNAUTHORIZED` variable

#### Scenario: Lambda environment does not include NODE_TLS_REJECT_UNAUTHORIZED
- **WHEN** a Lambda function starts
- **THEN** `process.env.NODE_TLS_REJECT_UNAUTHORIZED` SHALL be undefined

### Requirement: Sequelize migrations verify the RDS server certificate
The Sequelize configuration in `config/config.js` SHALL load the CA bundle via `fs.readFileSync` and use `ssl: { ca: caCert, rejectUnauthorized: true }` for database connections during migrations.

#### Scenario: Migration config loads CA bundle at runtime
- **WHEN** `config/config.js` is loaded by Sequelize CLI
- **THEN** it SHALL read `global-bundle.pem` via `fs.readFileSync` with a path relative to `__dirname`

#### Scenario: Migration connects with TLS verification
- **WHEN** `npx sequelize-cli db:migrate` runs
- **THEN** the database connection SHALL use `rejectUnauthorized: true` with the loaded CA certificate
