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
  await psql.clean()

  const waves = results.map((row: any) => plainToClass(Wave, row))
  const noMoreData = waves.length < limit

  return {
    waves,
    batch,
    noMoreData
  }
}
