import { plainToClass } from 'class-transformer'
import { validate as uuidValidate } from 'uuid'

import psql from '../../psql'

import { Wave } from '../../models/wave'

export default async function main (
  waveUuid: string,
  photoId: string
): Promise<Wave> {
  if (!uuidValidate(waveUuid)) {
    throw new Error('Wrong UUID format for waveUuid')
  }
  if (!uuidValidate(photoId)) {
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

  // Fetch the wave to return
  const result = await psql.query(`
    SELECT * FROM "Waves"
    WHERE "waveUuid" = $1
  `, [waveUuid])

  await psql.clean()

  return plainToClass(Wave, result.rows[0])
}
