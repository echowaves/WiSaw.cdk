# Brief — codebase research

Repository: /Users/dmitry/hacks/wisaw/WiSaw.cdk (the working directory)
Commit: 38133710df3e915f2c4286f9643b77a22cdbfccc (short 3813371), branch main, clean tree.

## Questions

1. `how` — How does SEO injection for `/photos/<uuid>` and `/videos/<uuid>` work at the CloudFront edge, from request to response?
2. `how` — How are the `seo/*.json` sidecar objects created, published, and read across the system?
3. `what touches X` — What code touches a photo's deletion lifecycle, from user request through database row to S3 objects?
4. `how` — How does `scripts/cleanup-s3.js` classify and delete S3 keys?
5. `how` — How are the edge SEO behaviors and sidecar lifecycle verified by tests?
6. `why` — Why do the Lambda@Edge functions use string concatenation, byte-exact HTML matching, and a `DEPLOY_ENV=prod` gate?

## Budgets and validation

- File budget per analyzer: 15 files. History budget for the historian: 10 commits followed.
- Validation level: high — every claim gets a ledger line and a verifier's verdict.

## Paths excluded from every search

Search these out of every command (`-- . ':(exclude)_bmad-output' ':(exclude)_bmad' ...`), at every commit including diffs:

- `_bmad-output/`
- `_bmad/`
- `.agents/`
- `.claude/`
- `AGENTS.md`
- `CLAUDE.md`
