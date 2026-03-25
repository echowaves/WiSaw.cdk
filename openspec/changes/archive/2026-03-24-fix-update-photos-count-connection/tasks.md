## 1. Fix _updatePhotosCount

- [x] 1.1 Remove `psql.connect()` and `psql.clean()` from `lambda-fns/controllers/waves/_updatePhotosCount.ts`, keeping only the UPDATE query and return
