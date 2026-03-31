import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { buildSearchClause } from '../../utilities/searchClause'

export default async function main (
  uuid: string,
  pageNumber: number,
  batch: string,
  searchTerm?: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
    nextPage: number | null
  }> {
  assertValidUuid(uuid, 'uuid')

  const limit = 100
  const offset = pageNumber * limit

  await psql.connect()

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 3)

  const query = `
    SELECT
      row_number() OVER (ORDER BY p."updatedAt" DESC) + ${offset} as row_number,
      p.*
    FROM "Photos" p
    LEFT JOIN "WavePhotos" wp
      ON p.id = wp."photoId"
    WHERE
      p."uuid" = $1
    AND p.active = true
    AND wp."photoId" IS NULL
    ${searchClause}
    ORDER BY p."updatedAt" DESC
    LIMIT $2
    OFFSET ${offset}
  `

  const results =
  (await psql.query(query, [uuid, limit, ...searchParams])
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
