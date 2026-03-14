import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'
import { validate as uuidValidate } from 'uuid'

export default async function main (
  pageNumber: number,
  batch: string,
  uuid: string
): Promise<{
    waves: Wave[]
    batch: string
    noMoreData: boolean
  }> {
  if (!uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  const limit = 20
  const offset = pageNumber * limit

  await psql.connect()

  const query = `
    SELECT DISTINCT "Waves".* FROM "Waves"
    JOIN "WaveUsers" ON "Waves"."waveUuid" = "WaveUsers"."waveUuid"
    WHERE "WaveUsers"."uuid" = $1
    ORDER BY "Waves"."updatedAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const results = (await psql.query(query, [uuid])).rows

  const waveUuids = results.map((row: any) => row.waveUuid)

  let photosByWave: Record<string, string[]> = {}
  if (waveUuids.length > 0) {
    const photosQuery = `
      SELECT "WavePhotos"."waveUuid", "Photos"."id"
      FROM "WavePhotos"
      JOIN "Photos" ON "Photos"."id" = "WavePhotos"."photoId"
      WHERE "WavePhotos"."waveUuid" = ANY($1)
      AND "Photos"."active" = true
      ORDER BY "Photos"."createdAt" DESC
    `
    const photosResults = (await psql.query(photosQuery, [waveUuids])).rows
    for (const photo of photosResults) {
      if (!photosByWave[photo.waveUuid]) {
        photosByWave[photo.waveUuid] = []
      }
      photosByWave[photo.waveUuid].push(
        `https://${process.env.S3_IMAGES}/${photo.id}-thumb.webp`
      )
    }
  }

  await psql.clean()

  const waves = results.map((row: any) => {
    const wave = plainToClass(Wave, row)
    wave.photos = photosByWave[wave.waveUuid] || []
    return wave
  })
  const noMoreData = waves.length < limit

  return {
    waves,
    batch,
    noMoreData
  }
}
