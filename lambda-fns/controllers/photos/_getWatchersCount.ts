import psql from '../../psql'

// Read-only count of a photo's watchers, EXCLUDING the photo owner
// ("Watchers"."uuid" != "Photos"."uuid"). Mirrors the owner-exclusion semantics
// of _updateWatchers, which maintains the feed's denormalized
// "Photos"."watchersCount" column. This is a pure SELECT and must never mutate
// "Watchers" or "Photos".

export const _getWatchersCount = async (photoId: string): Promise<number> => {
  await psql.connect()

  const result =
    (await psql.query(`
  SELECT COUNT(w.id)::int AS count
  FROM "Watchers" w
  JOIN "Photos" p ON p.id = w."photoId"
  WHERE w."photoId" = $1
    AND w."uuid" != p."uuid"
  `, [photoId])
  ).rows[0]
  await psql.clean()

  return result?.count ?? 0
}
