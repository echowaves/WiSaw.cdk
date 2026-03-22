import moment from 'moment'
import { validate as uuidValidate } from 'uuid'

import psql from '../../psql'
import { isValidPhotoId } from '../../utilities/isValidPhotoId'
import { _updatePhotosCount } from './_updatePhotosCount'

export default async function main (
  waveUuid: string,
  photoId: string,
  uuid: string
): Promise<boolean> {
  if (!uuidValidate(waveUuid)) {
    throw new Error('Wrong UUID format for waveUuid')
  }
  if (!isValidPhotoId(photoId)) {
    throw new Error('Wrong UUID format for photoId')
  }
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  await psql.connect()

  const existing = (await psql.query(`
    SELECT "waveUuid" FROM "WavePhotos" WHERE "photoId" = $1 LIMIT 1
  `, [photoId])).rows[0]

  if (existing != null && existing.waveUuid !== waveUuid) {
    await psql.clean()
    throw new Error('Photo is already in a wave')
  }

  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss')
  const updatedAt = createdAt

  await psql.query(`
    INSERT INTO "WavePhotos" (
      "waveUuid",
      "photoId",
      "createdBy",
      "createdAt",
      "updatedAt"
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5
    ) ON CONFLICT ("waveUuid", "photoId") DO NOTHING
  `, [
    waveUuid,
    photoId,
    uuid,
    createdAt,
    updatedAt
  ])
  await _updatePhotosCount(waveUuid)
  await psql.clean()

  return true
}
