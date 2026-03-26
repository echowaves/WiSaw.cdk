## MODIFIED Requirements

### Requirement: Environment sample documents all connection pool parameters
The `.env.sample` file SHALL include all environment variables that `ManagedServerlessClient` reads for connection tuning. It SHALL NOT include parameters that are not consumed by the client. Each parameter SHALL have an inline comment explaining its purpose and unit. The `.env.*` files SHALL retain `username` for Sequelize migration compatibility (`config/config.js`). The `.env.*` files SHALL NOT include `NODE_TLS_REJECT_UNAUTHORIZED` since TLS verification is handled per-connection via the `ssl.ca` option.

#### Scenario: Required parameters present
- **WHEN** a developer reviews `.env.sample`
- **THEN** it SHALL contain `username`, `PG_MAX_CONNECTIONS`, `PG_HEALTH_CHECK_INTERVAL_MS`, `PG_HEALTH_CHECK_TIMEOUT_MS`, `PG_CONNECTION_MAX_LIFETIME_MS`, and `PG_CLIENT_DEBUG`

#### Scenario: Dead parameters removed
- **WHEN** a developer reviews `.env.sample`
- **THEN** it SHALL NOT contain `max`, `timeout`, `idle_timeout`, `max_lifetime`, or `NODE_TLS_REJECT_UNAUTHORIZED`

#### Scenario: PG_MAX_CONNECTIONS documents clean() threshold purpose
- **WHEN** a developer reviews `.env.sample`
- **THEN** the `PG_MAX_CONNECTIONS` comment SHALL explain it controls the `serverless-postgres` `clean()` threshold, not per-container connection count

#### Scenario: username field has pg compatibility comment
- **WHEN** a developer reviews `.env.sample`
- **THEN** the `username` field SHALL have a comment noting that `psql.ts` maps it to `user` for pg driver compatibility
