import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'
import { validate as uuidValidate } from 'uuid'

export default async function main (
  pageNumber: number,
  batch: string,
  uuid?: string
): Promise<{
    waves: Wave[]
    batch: string
    noMoreData: boolean
  }> {
  if (uuid !== undefined && uuid !== null && !uuidValidate(uuid)) {
    throw new Error('Wrong UUID format for uuid')
  }

  const limit = 20
  const offset = pageNumber * limit

  await psql.connect()

  let query = `
    SELECT DISTINCT "Waves".* FROM "Waves"
  `
  const params = []

  if (uuid !== undefined && uuid !== null) {
    query += ' JOIN "WavePhotos" ON "Waves"."waveUuid" = "WavePhotos"."waveUuid"'
    query += ' WHERE "WavePhotos"."createdBy" = $1'
    params.push(uuid)
  }

  query += `
    ORDER BY "Waves"."updatedAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const results = (await psql.query(query, params)).rows
  await psql.clean()

  const waves = results.map((row: any) => plainToClass(Wave, row))
  const noMoreData = waves.length < limit

  return {
    waves,
    batch,
    noMoreData
  }
}
