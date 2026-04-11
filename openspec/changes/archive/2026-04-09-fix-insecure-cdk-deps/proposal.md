## Why

Two medium-severity CVEs in transitive dependencies of `aws-cdk-lib@2.241.0`:
- **CVE-2026-33532**: `yaml@1.10.2` — DoS via deeply nested YAML document parsing (fix: 1.10.3)
- **CVE-2026-33750**: `brace-expansion@5.0.3` — DoS via zero step value in brace pattern (fix: 5.0.5)

Both are build-time only (CDK synth/deploy), not Lambda runtime, but should be fixed to keep the dependency tree clean.

## What Changes

- Upgrade `aws-cdk-lib` from `2.241.0` to `2.248.0` in `package.json`
  - Directly fixes yaml (CDK 2.248.0 pins `yaml: 1.10.3`)
  - Allows npm to resolve `minimatch@10.2.5` which pins `brace-expansion: ^5.0.5`
- Clean install to regenerate `package-lock.json`

## Capabilities

### New Capabilities

_None_

### Modified Capabilities

_None — dependency upgrade only, no requirement changes_

## Impact

- `package.json` — `aws-cdk-lib` version bump
- `package-lock.json` — regenerated with fixed transitive deps
- No code changes, no schema changes, no migration changes
