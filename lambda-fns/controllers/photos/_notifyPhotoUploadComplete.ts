import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'

interface PhotoUploadResult {
  photoId: string
  waveUuid: string | null
  photosGrouped: number
}

export default async function main (photoId: string, photosGrouped: number): Promise<PhotoUploadResult> {
  assertValidUuid(photoId, 'photoId')

  // Query the database to find which wave this photo was grouped into
  await psql.connect()
  try {
    const result = await psql.query(`
      SELECT wp."waveUuid"
      FROM "WavePhotos" wp
      WHERE wp."photoId" = $1
      LIMIT 1
    `, [photoId])

    const waveUuid = result.rows.length > 0 ? result.rows[0].waveUuid : null

    return { photoId, waveUuid, photosGrouped }
  } finally {
    await psql.clean()
  }
}
