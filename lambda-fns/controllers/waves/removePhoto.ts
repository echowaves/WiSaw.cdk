import { plainToClass } from 'class-transformer'

import psql from '../../psql'

import { Wave } from '../../models/wave'

export default async function main (
  waveId: string,
  photoId: string
): Promise<Wave> {
  await psql.connect()

  await psql.query(`
    DELETE FROM "WavePhotos"
    WHERE "wave_id" = $1 AND "photo_id" = $2
  `, [
    waveId,
    photoId
  ])

  // Fetch the wave to return
  const result = await psql.query(`
    SELECT * FROM "Waves"
    WHERE "id" = $1
  `, [waveId])

  await psql.clean()

  return plainToClass(Wave, result.rows[0])
}
