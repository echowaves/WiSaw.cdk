import moment from 'moment'
import { validate as uuidValidate } from 'uuid'

import psql from '../../psql'

export default async function main (
  waveUuid: string,
  photoId: string,
  uuid: string
): Promise<boolean> {
  if (!uuidValidate(waveUuid)) {
    throw new Error('Wrong UUID format for waveUuid')
  }
  if (!uuidValidate(photoId)) {
    throw new Error('Wrong UUID format for photoId')
  }
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  await psql.connect()

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

  await psql.clean()

  return true
}
