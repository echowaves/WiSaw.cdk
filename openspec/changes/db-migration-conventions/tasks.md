## 1. Create the spec file in openspec/specs

- [ ] 1.1 Create `openspec/specs/db-migration-conventions/SPEC.md` with the full spec content from the change's specs artifact, covering all 14 requirements (file naming, async/await syntax, down methods, table naming, column naming, UUID primary keys, constraint/index naming, queryInterface preference, PostGIS geometry, progress logging, try-catch error handling, schema/data separation, no explicit transactions)

## 2. Create an instructions file for AI-assisted migration generation

- [ ] 2.1 Create `.github/instructions/db-migrations.instructions.md` with frontmatter `applyTo: 'migrations/**'` that summarizes the key conventions as concise rules for AI agents generating migration code
