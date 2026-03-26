## ADDED Requirements

### Requirement: RDS CA certificate bundle is included in Lambda deployments
The project SHALL include the AWS RDS us-east-1 CA certificate bundle (`us-east-1-bundle.pem`) at `lambda-fns/certs/us-east-1-bundle.pem`. This file SHALL be downloaded from the official AWS RDS certificate bundle URL and committed to the repository.

#### Scenario: Certificate file exists in source tree
- **WHEN** the Lambda code is bundled for deployment
- **THEN** the `certs/us-east-1-bundle.pem` file SHALL be included in the deployment package alongside other `lambda-fns/` files

#### Scenario: Certificate is loaded at module initialization
- **WHEN** `psql.ts` module is loaded during Lambda cold start
- **THEN** it SHALL read `certs/us-east-1-bundle.pem` once using `fs.readFileSync()` at module scope

### Requirement: pg.Client SSL uses explicit CA for certificate verification
The `ManagedServerlessClient` singleton SHALL configure `pg.Client` SSL with `rejectUnauthorized: true` and the bundled RDS CA certificate via the `ca` option. This ensures the RDS server certificate chain is verified against the known Amazon RDS root CA.

#### Scenario: SSL config includes CA certificate
- **WHEN** the `ManagedServerlessClient` singleton is created
- **THEN** the SSL config SHALL include `{ rejectUnauthorized: true, ca: <contents of us-east-1-bundle.pem> }`

#### Scenario: TLS handshake succeeds with RDS
- **WHEN** the Lambda connects to RDS PostgreSQL
- **THEN** the TLS handshake SHALL succeed because the bundled CA matches the RDS certificate chain (`rds-ca-rsa2048-g1`)

#### Scenario: Connection fails if certificate doesn't match
- **WHEN** the RDS certificate does not match the bundled CA (e.g., wrong region or rotated CA)
- **THEN** the connection SHALL fail with a TLS error rather than silently accepting an untrusted certificate

### Requirement: Sequelize migration SSL uses explicit CA for certificate verification
The Sequelize config (`config/config.js`) SHALL configure `dialectOptions.ssl` with `rejectUnauthorized: true` and the bundled RDS CA certificate via the `ca` option, matching the runtime configuration.

#### Scenario: Migration SSL config includes CA certificate
- **WHEN** Sequelize runs migrations against the production database
- **THEN** the SSL config SHALL include `{ rejectUnauthorized: true, ca: <contents of us-east-1-bundle.pem> }`

### Requirement: NODE_TLS_REJECT_UNAUTHORIZED is removed from environment
The `NODE_TLS_REJECT_UNAUTHORIZED` environment variable SHALL be removed from all `.env.*` files since TLS verification is handled per-connection via the `ca` option. This eliminates the global TLS bypass and its associated Node.js runtime warning.

#### Scenario: Environment files do not set NODE_TLS_REJECT_UNAUTHORIZED
- **WHEN** a developer reviews `.env.sample`, `.env.prod`, or `.env.test`
- **THEN** none of these files SHALL contain `NODE_TLS_REJECT_UNAUTHORIZED`

#### Scenario: No TLS warning in Lambda logs
- **WHEN** a Lambda function executes
- **THEN** the Node.js runtime SHALL NOT emit a `DeprecationWarning` about `NODE_TLS_REJECT_UNAUTHORIZED`
