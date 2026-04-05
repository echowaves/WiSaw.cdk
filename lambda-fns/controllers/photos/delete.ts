import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _isPhotoInFrozenWave } from '../waves/_isPhotoInFrozenWave'
import { _updatePhotosCount } from '../waves/_updatePhotosCount'

// import Photo from '../../models/photo'

export default async function main (photoId: string, uuid: string): Promise<string> {
  // const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  if (await _isPhotoInFrozenWave(photoId)) {
    await psql.clean()
    throw new Error('Cannot delete a photo that is in a frozen wave')
  }

  await psql.query(`
      UPDATE "Photos"
    SET "active" = false
    WHERE id = $1
    `, [photoId])

  // Update wave photosCount if photo was in a wave
  const waveResult = await psql.query(`
    SELECT "waveUuid" FROM "WavePhotos" WHERE "photoId" = $1 LIMIT 1
  `, [photoId])
  if (waveResult.rows.length > 0) {
    await _updatePhotosCount(waveResult.rows[0].waveUuid)
  }

  await psql.clean()

  return 'OK'
}
