<!-- bmad:context -->
<!-- Verified 2026-11-06 against e3a6112. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## WiSaw.cdk

AWS CDK infrastructure for WiSaw: AppSync GraphQL over Postgres/Sequelize, Lambda resolvers/controllers, CloudFront with Lambda@Edge SEO injection. The API schema is `graphql/schema.graphql` here; mobile clients consume it. There is no CI in this repo — nothing checks your change before merge.

## Policy

- Use BMad skills as the sole structured workflow for product and engineering work; do not invoke other workflow systems.
- Never run an AWS-mutating command (`cdk deploy`, `cdk destroy`, S3 writes, migrations against a live DB) — give the user the exact command and use the output they paste back. Never touch prod or prod credentials.
- `.env` must never be committed; secrets must never be hardcoded — use CDK context/environment config.
- Never hand-edit `graphql/schema.graphql` without following the GraphQL operation checklist below.

## Where things are

- New GraphQL query/mutation: read `.github/instructions/graphql-operations.instructions.md` first — four files must change together, and a missing resolver entry fails silently.
- Writing a Sequelize migration: read `.github/instructions/db-migrations.instructions.md` first.
- SEO edge injector (meta tags, canonicals, crawler-visible body): `lambda-fns/lambdas/injectMetaTagsLambdaFunction/`; wired in `lib/resources/lambdas.ts` and `lib/resources/cloud-front.ts`.
- Photo caption/label text reaches the edge only as an S3 sidecar: writer `lambda-fns/utilities/seoSidecar.ts` (`seo/<id>.json`), reader `injectMetaTagsLambdaFunction/sidecar.js` + `seoText.js` — change both sides in one commit, or photo pages silently lose text.

## Running and verifying

- Run one test file while iterating: `npx mocha --exit --require @babel/register tests/<name>.js` — `npm test` runs the whole suite under nyc.
- Any `cdk` command needs a local `.env.test` (or `.env.prod`): `lib/utilities/config.ts` requires it at import and both are gitignored — copy from `.env.sample`.
- The full suite has 5 pre-existing `getSeasonBoundaries` timezone failures on main; don't chase them as regressions.

## Conventions that differ from defaults

- Dependencies are pinned to exact versions (no `^`/`~`) in `package.json`.
- Maximum cyclomatic complexity 8 — extract helpers and use early returns; `npm run lint` (ts-standard) does not check it.

## Known pitfalls

- Lambda@Edge functions (injectMetaTags, redirect) are only created when `DEPLOY_ENV=prod` (`lib/resources/lambdas.ts`) — changes to them never deploy from the test stack; verify with `tests/inject-meta-tags.js`.
- HTML rewrites in the edge injector must match deployed template bytes exactly — a silent canonical mismatch once deindexed ~22k pages. Keep byte-exact regression cases in `tests/inject-meta-tags.js` and `tests/seo-crawler-contract.js`.

<!-- /bmad:context -->
