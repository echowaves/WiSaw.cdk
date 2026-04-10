## 1. Upgrade aws-cdk-lib

- [x] 1.1 Update `aws-cdk-lib` from `2.241.0` to `2.248.0` in `package.json`
- [x] 1.2 Run `rm -rf node_modules package-lock.json && npm install` to regenerate the lockfile with fixed transitive deps
- [x] 1.3 Verify `yaml` resolved to `1.10.3` and `brace-expansion` to `5.0.5` under `aws-cdk-lib` in `package-lock.json`
- [x] 1.4 Run `npx cdk synth` to confirm the stack still synthesises cleanly
