import psql from '../../psql'
import { Wave } from '../../models/wave'
import { plainToClass } from 'class-transformer'

export default async function main (
  pageNumber: number,
  batch: string,
  createdBy?: string
): Promise<{
    waves: Wave[]
    batch: string
    noMoreData: boolean
  }> {
  const limit = 20
  const offset = pageNumber * limit

  await psql.connect()

  let query = `
    SELECT * FROM "Waves"
  `
  const params = []

  if (createdBy !== undefined && createdBy !== null) {
    query += ' WHERE "createdBy" = $1'
    params.push(createdBy)
  }

  query += `
    ORDER BY "updatedAt" DESC
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
