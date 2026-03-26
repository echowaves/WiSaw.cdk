## Context

Lambda functions and Sequelize migrations already use the RDS CA bundle (`lambda-fns/certs/global-bundle.pem`) with `ssl: { ca: rdsCa, rejectUnauthorized: true }`. Three utility scripts in `scripts/` still connect with `ssl: { rejectUnauthorized: false }`, disabling TLS certificate verification. This triggers CRITICAL Codacy findings and leaves script-based database connections vulnerable to MITM attacks.

## Goals / Non-Goals

**Goals:**
- Utility scripts SHALL verify the RDS server certificate using the same CA bundle that Lambdas and migrations use.
- Resolve all 3 CRITICAL SSL-related Codacy findings in `scripts/`.

**Non-Goals:**
- Changing the `config/config.js` File Access finding — it is a false positive (fully static path) and requires no code change.
- Centralizing database connection logic across scripts and Lambdas — out of scope.
- Changing how Lambda functions or migrations handle TLS — already correct.

## Decisions

### Load the CA bundle with `fs.readFileSync` + `path.join(__dirname, ...)`

Each script will load the CA cert at module level using the same approach as `config/config.js`. This is the simplest path — no new dependencies, no shared module needed.

**Alternative considered**: Import a shared helper from `config/config.js` — rejected because the scripts already have self-contained connection setup and `config.js` exports a Sequelize-shaped config, not a raw CA string.

### Use `ssl: { ca: rdsCa, rejectUnauthorized: true }`

Matches the pattern used in `psql.ts` (Lambdas) and `config/config.js` (migrations). Ensures the RDS server certificate is validated against the AWS-provided CA bundle.

## Risks / Trade-offs

- **Risk**: Scripts run from developer machines that may not have the `global-bundle.pem` file checked out → **Mitigation**: The file is committed to the repo at `lambda-fns/certs/global-bundle.pem`; it will always be present after `git clone`.
- **Risk**: Developers using non-RDS Postgres (e.g., local Docker) may get TLS errors → **Mitigation**: Local/dev connections typically don't use SSL at all; scripts accept an `env` argument and the dev `.env` config can omit SSL settings or scripts can be run against environments that have valid certs.
