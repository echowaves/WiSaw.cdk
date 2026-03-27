import moment from 'moment'

import psql from '../../psql'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _updatePhotosCount } from './_updatePhotosCount'

export default async function main (
  waveUuid: string,
  photoId: string,
  uuid: string
): Promise<boolean> {
  assertValidUuid(waveUuid, 'waveUuid')
  assertValidUuid(photoId, 'photoId')
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const existing = (await psql.query(`
    SELECT "waveUuid" FROM "WavePhotos" WHERE "photoId" = $1 LIMIT 1
  `, [photoId])).rows[0]

  if (existing != null && existing.waveUuid !== waveUuid) {
    await psql.query(`
      DELETE FROM "WavePhotos" WHERE "waveUuid" = $1 AND "photoId" = $2
    `, [existing.waveUuid, photoId])
    await _updatePhotosCount(existing.waveUuid)
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
