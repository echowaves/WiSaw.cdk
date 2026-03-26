## 1. Update scripts to use CA-verified TLS

- [x] 1.1 In `scripts/cleanup-s3.js`, add `fs` and `path` requires, load the CA bundle from `lambda-fns/certs/global-bundle.pem`, and replace `ssl: { rejectUnauthorized: false }` with `ssl: { ca: rdsCa, rejectUnauthorized: true }`
- [x] 1.2 In `scripts/populate-photo-dimensions.js`, add `fs` and `path` requires, load the CA bundle, and replace `ssl: { rejectUnauthorized: false }` with `ssl: { ca: rdsCa, rejectUnauthorized: true }`
- [x] 1.3 In `scripts/populate-recognitions.js`, add `fs` and `path` requires, load the CA bundle, and replace `ssl: { rejectUnauthorized: false }` with `ssl: { ca: rdsCa, rejectUnauthorized: true }`

## 2. Update spec

- [x] 2.1 Update `openspec/specs/script-database-access/spec.md` to require CA-verified TLS instead of `rejectUnauthorized: false`
