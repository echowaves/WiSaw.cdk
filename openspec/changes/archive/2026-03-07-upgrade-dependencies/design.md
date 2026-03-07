## Context

WiSaw.cdk uses a fully pinned exact-version strategy for all npm dependencies. The project runs on Node.js with TypeScript, deploys via AWS CDK, and uses ESLint (with `ts-standard` on top) for linting. Two tooling-only major version bumps are included in this upgrade: `eslint` v9→v10 and `nyc` v17→v18.

Current: package.json with 26 outdated packages across `dependencies` and `devDependencies`.

## Goals / Non-Goals

**Goals**
- Bring all 26 outdated packages to their latest exact versions
- Verify the two major-version tooling upgrades (`eslint` v10, `nyc` v18) don't break linting or test commands
- Keep all version strings exact (no `^` or `~`)

**Non-Goals**
- Upgrading packages that are already at latest (e.g. `moment`, `sharp`, `uuid`, `typescript`)
- Runtime or API behavior changes
- Migrating off deprecated packages (separate concern)

## Decisions

**Upgrade all packages in one batch**
Each AWS SDK `@aws-sdk/*` package moves from `3.933.0` → `3.1003.0` together; the SDK packages are co-versioned so they must all move together. Same applies to CDK (`aws-cdk` + `aws-cdk-lib` must stay in sync) and `@typescript-eslint/*` plugin + parser (must share the same version).

**Verify ESLint v10 compatibility before committing**
ESLint v10 removes support for the legacy `.eslintrc.*` config format. The project uses `ts-standard` which bundles its own ESLint config, so the risk is low — but the lint command must be run after upgrade to confirm no errors.

**Verify nyc v18 CLI compatibility**
The test script calls `./node_modules/nyc/bin/nyc.js` directly. nyc v18 may rename or restructure CLI entry points. The test script must be run after upgrade to confirm it still works; if the path changes, `package.json` scripts must be updated.

## Risks / Trade-offs

- **eslint 9→10** → Mitigation: Run `npm run lint` after upgrade; if `ts-standard` is incompatible with ESLint v10 it may need a separate update pass
- **nyc 17→18** → Mitigation: Run `npm test` after upgrade; fix any CLI path or flag regressions in the `test` script
- **@types/node 24→25** → Mitigation: `@types/node` v25 tracks Node.js v25 types; verify no type errors introduced by running `tsc --noEmit`
- **`aws-cdk` / `aws-cdk-lib` minor bump** → CDK minor releases are backward-compatible; low risk

## Migration Plan

1. Edit `package.json` — update all 26 version strings to exact latest
2. Run `npm install` to apply changes and regenerate `package-lock.json`
3. Run `npx tsc --noEmit` to confirm no TypeScript type errors
4. Run `npm run lint` to confirm ESLint v10 compatibility
5. Run `npm test` to confirm nyc v18 compatibility
6. Commit `package.json` and `package-lock.json`

## Open Questions

- If `ts-standard` is incompatible with ESLint v10, should we pin eslint to 9.x for now? → Defer to implementation; revert `eslint` to `9.39.1` if lint breaks and `ts-standard` has no v10-compatible release yet.
