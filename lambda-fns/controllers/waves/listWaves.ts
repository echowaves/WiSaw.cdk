import psql from '../../psql'
import { Wave } from '../../models/wave'
import Photo from '../../models/photo'
import { plainToClass } from 'class-transformer'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { _isWaveFrozen } from './_isWaveFrozen'

const DEEP_LINK_BASE_URL = process.env.DEEP_LINK_BASE_URL ?? ''

const ALLOWED_SORT_FIELDS: Record<string, string> = {
  createdAt: '"createdAt"',
  updatedAt: '"updatedAt"',
  name: '"name"'
}

const ALLOWED_DIRECTIONS: Record<string, string> = {
  asc: 'ASC',
  desc: 'DESC'
}

export default async function main (
  pageNumber: number,
  batch: string,
  uuid: string,
  sortBy?: string,
  sortDirection?: string,
  searchTerm?: string
): Promise<{
    waves: Wave[]
    batch: string
    noMoreData: boolean
  }> {
  assertValidUuid(uuid, 'uuid')

  const limit = 20
  const offset = pageNumber * limit

  const sortField = ALLOWED_SORT_FIELDS[sortBy ?? 'updatedAt']
  if (sortField == null) {
    throw new Error('Invalid sort field')
  }
  const direction = ALLOWED_DIRECTIONS[sortDirection ?? 'desc']
  if (direction == null) {
    throw new Error('Invalid sort direction')
  }

  await psql.connect()

  const params: any[] = [uuid]
  let searchClause = ''
  if (searchTerm && searchTerm.trim().length > 0) {
    params.push(`%${searchTerm.trim()}%`)
    searchClause = `AND ("Waves"."name" ILIKE $2 OR "Waves"."description" ILIKE $2)`
  }

  const query = `
    SELECT "Waves".*, "WaveUsers"."role" AS "myRole" FROM "Waves"
    JOIN "WaveUsers" ON "Waves"."waveUuid" = "WaveUsers"."waveUuid"
    WHERE "WaveUsers"."uuid" = $1
    ${searchClause}
    ORDER BY "Waves".${sortField} ${direction}
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const results = (await psql.query(query, params)).rows

  const waveUuids = results.map((row: any) => row.waveUuid)

  let photosByWave: Record<string, any[]> = {}
  if (waveUuids.length > 0) {
    const photosQuery = `
      SELECT "waveUuid", ranked.*
      FROM (
        SELECT "WavePhotos"."waveUuid",
               "Photos".*,
               ROW_NUMBER() OVER (PARTITION BY "WavePhotos"."waveUuid" ORDER BY "Photos"."updatedAt" DESC) AS row_num
        FROM "WavePhotos"
        JOIN "Photos" ON "Photos"."id" = "WavePhotos"."photoId"
        WHERE "WavePhotos"."waveUuid" = ANY($1)
        AND "Photos"."active" = true
      ) ranked
      WHERE row_num <= 5
    `
    const photosResults = (await psql.query(photosQuery, [waveUuids])).rows
    for (const row of photosResults) {
      if (!photosByWave[row.waveUuid]) {
        photosByWave[row.waveUuid] = []
      }
      const photo = plainToClass(Photo, { ...row, row_number: row.row_num })
      photosByWave[row.waveUuid].push(photo.toJSON())
    }
  }

  await psql.clean()

  const waves = results.map((row: any) => {
    const wave = plainToClass(Wave, row)
    wave.photos = photosByWave[wave.waveUuid] || []
    wave.myRole = row.myRole
    wave.isFrozen = _isWaveFrozen(row)
    wave.joinUrl = row.open === true ? `${DEEP_LINK_BASE_URL}/wave/join/${wave.waveUuid}` : null
    return wave
  })
  const noMoreData = waves.length < limit

  return {
    waves,
    batch,
    noMoreData
  }
}
