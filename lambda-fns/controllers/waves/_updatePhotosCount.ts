import psql from '../../psql'
import moment from 'moment'

export const _updatePhotosCount = async (waveUuid: string) => {
  const updatedAt = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  await psql.connect()
  const wave =
  (await psql.query(
    `UPDATE "Waves" SET "photosCount" =
      (SELECT COUNT(*) FROM "WavePhotos"
       JOIN "Photos" ON "Photos"."id" = "WavePhotos"."photoId"
       WHERE "WavePhotos"."waveUuid" = $1 AND "Photos"."active" = true),
      "updatedAt" = $3
      WHERE "waveUuid" = $2
      RETURNING *`, [waveUuid, waveUuid, updatedAt])
  ).rows[0]
  await psql.clean()
  return wave.photosCount
}
