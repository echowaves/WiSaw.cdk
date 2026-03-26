## 1. CA Certificate Setup

- [x] 1.1 Download the AWS RDS global CA bundle (`global-bundle.pem`) to `lambda-fns/certs/global-bundle.pem`
- [x] 1.2 Create TypeScript declaration file `lambda-fns/certs/pem.d.ts` declaring `*.pem` modules as string default exports

## 2. Lambda Database Client

- [x] 2.1 Update `lambda-fns/psql.ts` to import the CA bundle and use `ssl: { ca: rdsCa, rejectUnauthorized: true }`

## 3. CDK Bundling Configuration

- [x] 3.1 Add `loader: { '.pem': 'text' }` to all 7 `NodejsFunction` bundling configs in `lib/resources/lambdas.ts`

## 4. Environment Variables

- [x] 4.1 Remove `NODE_TLS_REJECT_UNAUTHORIZED` from `.env.sample`
- [x] 4.2 Remove `NODE_TLS_REJECT_UNAUTHORIZED` from `.env.test`
- [x] 4.3 Remove `NODE_TLS_REJECT_UNAUTHORIZED` from `.env.prod`

## 5. Sequelize Migration Config

- [x] 5.1 Update `config/config.js` to load the CA bundle via `fs.readFileSync` and set `ssl: { ca: caCert, rejectUnauthorized: true }`

## 6. Utility Scripts

- [x] 6.1 Update `scripts/cleanup-s3.js` — replace `ssl: true` with `ssl: { rejectUnauthorized: false }` and remove the `NODE_TLS_REJECT_UNAUTHORIZED` block
- [x] 6.2 Update `scripts/populate-photo-dimensions.js` — replace `ssl: true` with `ssl: { rejectUnauthorized: false }` and remove the `NODE_TLS_REJECT_UNAUTHORIZED` block
- [x] 6.3 Update `scripts/populate-recognitions.js` — replace `ssl: true` with `ssl: { rejectUnauthorized: false }` and remove the `NODE_TLS_REJECT_UNAUTHORIZED` block

## 7. Verification

- [x] 7.1 Run `cdk synth` to verify esbuild bundles successfully with the `.pem` loader
- [x] 7.2 Deploy to test environment and verify Lambda connects to RDS without TLS errors
- [x] 7.3 Run `npx sequelize-cli db:migrate:status` to verify migration config connects with TLS verification
