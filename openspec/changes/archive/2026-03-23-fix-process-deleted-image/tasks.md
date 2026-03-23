## 1. Fix deletion order and parameterize queries

- [x] 1.1 Reorder `_cleanupTables` in `lambda-fns/lambdas/processDeletedImage/index.ts`: move WavePhotos deletion block first, then Watchers, Recognitions, Comments, and Photos last
- [x] 1.2 Replace string interpolation with parameterized queries (`$1`) for Photos, Watchers, Recognitions, and Comments DELETE statements
