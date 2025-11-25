import moment from 'moment'

import { plainToClass } from 'class-transformer'

import psql from '../../psql'

import { Wave } from '../../models/wave'

export default async function main (
  waveId: string,
  photoId: string,
  uuid: string
): Promise<Wave> {
  await psql.connect()

  const createdAt = moment().format('YYYY-MM-DD HH:mm:ss')
  const updatedAt = createdAt

  await psql.query(`
    INSERT INTO "WavePhotos" (
      "wave_id",
      "photo_id",
      "createdBy",
      "createdAt",
      "updatedAt"
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5
    ) ON CONFLICT ("wave_id", "photo_id") DO NOTHING
  `, [
    waveId,
    photoId,
    uuid,
    createdAt,
    updatedAt
  ])

  // Fetch the wave to return
  const result = await psql.query(`
    SELECT * FROM "Waves"
    WHERE "id" = $1
  `, [waveId])

  await psql.clean()

  return plainToClass(Wave, result.rows[0])
}
