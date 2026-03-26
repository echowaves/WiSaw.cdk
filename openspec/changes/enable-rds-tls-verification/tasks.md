## 1. Download and bundle RDS CA certificate

- [ ] 1.1 Download the `us-east-1-bundle.pem` from the AWS RDS certificate bundle page
- [ ] 1.2 Save it to `lambda-fns/certs/us-east-1-bundle.pem`

## 2. Configure runtime SSL with CA certificate

- [ ] 2.1 In `lambda-fns/psql.ts`, read the CA cert at module scope using `fs.readFileSync()`
- [ ] 2.2 Update the `ManagedServerlessClient` singleton SSL config to `{ rejectUnauthorized: true, ca: RDS_CA }`

## 3. Configure Sequelize migration SSL with CA certificate

- [ ] 3.1 In `config/config.js`, read the CA cert and set `dialectOptions.ssl.ca` to the cert contents
- [ ] 3.2 Set `rejectUnauthorized: true` in the Sequelize SSL config (remove the conditional based on `NODE_TLS_REJECT_UNAUTHORIZED`)

## 4. Remove NODE_TLS_REJECT_UNAUTHORIZED from environment

- [ ] 4.1 Remove `NODE_TLS_REJECT_UNAUTHORIZED` from `.env.sample`
- [ ] 4.2 Remove `NODE_TLS_REJECT_UNAUTHORIZED` from `.env.prod`
- [ ] 4.3 Remove `NODE_TLS_REJECT_UNAUTHORIZED` from `.env.test`

## 5. Verify

- [ ] 5.1 Run migrations against prod to verify Sequelize TLS works with the bundled CA
- [ ] 5.2 Deploy Lambda and verify connections succeed with `rejectUnauthorized: true`
- [ ] 5.3 Confirm no `NODE_TLS_REJECT_UNAUTHORIZED` warning appears in Lambda logs
