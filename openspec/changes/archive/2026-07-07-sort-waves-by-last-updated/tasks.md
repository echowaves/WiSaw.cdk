## 1. Update listWaves Controller

- [x] 1.1 Change `ORDER BY "Waves"."createdAt" DESC` to `ORDER BY "Waves"."updatedAt" DESC` in `lambda-fns/controllers/waves/listWaves.ts` line 34

## 2. Update Spec

- [x] 2.1 Update `openspec/specs/list-waves-sorting/spec.md` — change all `createdAt` references to `updatedAt` in the requirement text and scenario
