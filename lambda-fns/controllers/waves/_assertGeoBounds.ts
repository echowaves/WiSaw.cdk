import psql from '../../psql'

export const _assertGeoBounds = async (waveUuid: string, photoId: string): Promise<void> => {
  const waveResult = await psql.query(`
    SELECT "location", "radius" FROM "Waves"
    WHERE "waveUuid" = $1
  `, [waveUuid])

  const wave = waveResult.rows[0]
  if (!wave || wave.location === null) {
    return
  }

  const photoResult = await psql.query(`
    SELECT "location" FROM "Photos"
    WHERE "id" = $1
  `, [photoId])

  const photo = photoResult.rows[0]
  if (!photo || photo.location === null) {
    throw new Error('Photo must have location data for this geo-bounded wave')
  }

  const withinResult = await psql.query(`
    SELECT ST_DWithin(
      (SELECT "location"::geography FROM "Photos" WHERE "id" = $1),
      (SELECT "location"::geography FROM "Waves" WHERE "waveUuid" = $2),
      $3
    ) AS within
  `, [photoId, waveUuid, wave.radius * 1000])

  if (!withinResult.rows[0].within) {
    throw new Error('Photo is outside the wave geo-boundaries')
  }
}
