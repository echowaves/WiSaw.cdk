## 1. Fix search clause

- [x] 1.1 Change `"id"` to `p."id"` in `lambda-fns/utilities/searchClause.ts`

## 2. Standardize Photos table alias

- [x] 2.1 Add `p` alias to `FROM "Photos"` in `feedRecent.ts` and update column references
- [x] 2.2 Add `p` alias to `FROM "Photos"` in `feedByDate.ts` and update column references
