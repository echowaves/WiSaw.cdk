import psql from '../../psql'

export const _filterPhotosInRadius = async (
  photoIds: string[],
  waveUuid: string,
  radiusKm?: number
): Promise<Set<string>> => {
  if (photoIds.length === 0) {
    return new Set()
  }

  if (radiusKm != null) {
    const result = await psql.query(`
      SELECT "Photos"."id"
      FROM "Photos"
      WHERE "Photos"."id" = ANY($1)
        AND "Photos"."location" IS NOT NULL
        AND ST_DWithin(
          "Photos"."location"::geography,
          (SELECT "location"::geography FROM "Waves" WHERE "waveUuid" = $2),
          $3
        )
    `, [photoIds, waveUuid, radiusKm * 1000])
    return new Set(result.rows.map((row: any) => row.id))
  }

  const result = await psql.query(`
    SELECT "Photos"."id"
    FROM "Photos", "Waves"
    WHERE "Photos"."id" = ANY($1)
      AND "Waves"."waveUuid" = $2
      AND "Photos"."location" IS NOT NULL
      AND ST_DWithin(
        "Photos"."location"::geography,
        "Waves"."location"::geography,
        "Waves"."radius" * 1000
      )
  `, [photoIds, waveUuid])
  return new Set(result.rows.map((row: any) => row.id))
}
