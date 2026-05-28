import psql from '../../psql'
import moment from 'moment'

export const _updatePhotosCount = async (waveUuid: string) => {
  const wave =
  (await psql.query(
    `UPDATE "Waves" SET
      "photosCount" = sub.cnt,
      "updatedAt" = sub.last_photo_date,
      "freezeDate" = sub.last_photo_date
      FROM (
        SELECT COUNT(*) AS cnt, MAX("Photos"."createdAt") AS last_photo_date
        FROM "WavePhotos"
        JOIN "Photos" ON "Photos"."id" = "WavePhotos"."photoId"
        WHERE "WavePhotos"."waveUuid" = $1 AND "Photos"."active" = true
      ) sub
      WHERE "waveUuid" = $2
      RETURNING *`, [waveUuid, waveUuid])
  ).rows[0]
  return wave.photosCount
}

export const _incrementPhotosCount = async (waveUuid: string): Promise<number> => {
  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  const result = await psql.query(
    'UPDATE "Waves" SET "photosCount" = GREATEST("photosCount" + 1, 0), "updatedAt" = $2 WHERE "waveUuid" = $1 RETURNING "photosCount"',
    [waveUuid, updatedAt]
  )
  return result.rows[0]?.photosCount ?? 0
}
