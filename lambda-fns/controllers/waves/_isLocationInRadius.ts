import psql from '../../psql'

export const _isLocationInRadius = async (
  lat: number,
  lon: number,
  waveUuid: string,
  radiusKm?: number
): Promise<boolean> => {
  if (radiusKm != null) {
    const result = await psql.query(`
      SELECT ST_DWithin(
        ST_MakePoint($1, $2)::geography,
        "location"::geography,
        $3
      ) AS within
      FROM "Waves"
      WHERE "waveUuid" = $4
    `, [lon, lat, radiusKm * 1000, waveUuid])

    if (result.rows.length === 0) {
      throw new Error('Wave not found')
    }
    return result.rows[0].within
  }

  const result = await psql.query(`
    SELECT ST_DWithin(
      ST_MakePoint($1, $2)::geography,
      "location"::geography,
      "radius" * 1000
    ) AS within
    FROM "Waves"
    WHERE "waveUuid" = $3
  `, [lon, lat, waveUuid])

  if (result.rows.length === 0) {
    throw new Error('Wave not found')
  }
  return result.rows[0].within
}
