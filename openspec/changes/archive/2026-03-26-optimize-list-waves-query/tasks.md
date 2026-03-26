## 1. Query Optimization

- [x] 1.1 Remove `DISTINCT` from the SELECT statement in `lambda-fns/controllers/waves/listWaves.ts`

## 2. Database Indexes

- [x] 2.1 Create migration file `migrations/20260326120000-add-waves-list-indexes.js` that adds index `idx_Waves_updatedAt` on `Waves.updatedAt` and composite index `idx_WaveUsers_uuid_waveUuid` on `WaveUsers(uuid, waveUuid)`
- [x] 2.2 Run migration against test environment and verify indexes exist
