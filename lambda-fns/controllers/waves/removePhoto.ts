import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'

import { _updatePhotosCount } from './_updatePhotosCount'

export default async function main (
  waveUuid: string,
  photoId: string
): Promise<boolean> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(photoId, 'photoId')

  await psql.connect()

  await psql.query(`
    DELETE FROM "WavePhotos"
    WHERE "waveUuid" = $1 AND "photoId" = $2
  `, [
    waveUuid,
    photoId
  ])

  await _updatePhotosCount(waveUuid)
  await psql.clean()

  return true
}
