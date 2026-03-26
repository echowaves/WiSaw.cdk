## 1. Fix user mapping in scripts

- [x] 1.1 Add `user: config.username` to `ServerlessClient` constructor in `scripts/cleanup-s3.js`
- [x] 1.2 Add `user: config.username` to `ServerlessClient` constructor in `scripts/populate-photo-dimensions.js`
- [x] 1.3 Add `user: config.username` to `ServerlessClient` constructor in `scripts/populate-recognitions.js`

## 2. Verify

- [x] 2.1 Run `npm run cleanup-s3 prod -- --dry-run` and confirm database connects successfully
