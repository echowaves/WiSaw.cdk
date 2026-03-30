import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { buildSearchClause } from '../../utilities/searchClause'

export default async function main (
  waveUuid: string,
  pageNumber: number,
  batch: string,
  searchTerm?: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
    nextPage: number | null
  }> {
  assertValidUuid(waveUuid, 'waveUuid')

  const limit = 100
  const offset = pageNumber * limit

  await psql.connect()

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 2)

  const query = `
    SELECT
      row_number() OVER (ORDER BY p."updatedAt" DESC) + ${offset} as row_number,
      p.*
    FROM "Photos" p
    INNER JOIN "WavePhotos" wp
      ON p.id = wp."photoId"
    WHERE
      wp."waveUuid" = $1
    AND p.active = true
    ${searchClause}
    ORDER BY p."updatedAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const results =
  (await psql.query(query, [waveUuid, ...searchParams])
  ).rows
  await psql.clean()

  const photos = results.map((photo: any) => plainToClass(Photo, photo))

  let noMoreData = false

  if (photos.length < limit) {
    noMoreData = true
  }

  return {
    photos,
    batch,
    noMoreData,
    nextPage: noMoreData ? null : pageNumber + 1
  }
}
