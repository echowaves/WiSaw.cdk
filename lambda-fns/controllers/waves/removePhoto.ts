import { validate as uuidValidate } from 'uuid'

import psql from '../../psql'
import { isValidPhotoId } from '../../utilities/isValidPhotoId'

import { _updatePhotosCount } from './_updatePhotosCount'

export default async function main (
  waveUuid: string,
  photoId: string
): Promise<boolean> {
  if (!uuidValidate(waveUuid)) {
    throw new Error('Wrong UUID format for waveUuid')
  }
  if (!isValidPhotoId(photoId)) {
    throw new Error('Wrong UUID format for photoId')
  }

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
