import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { buildSearchClause } from '../../utilities/searchClause'

// import AbuseReport from '../../models/abuseReport'

export default async function main (
  uuid: string,
  pageNumber: number,
  batch: string,
  searchTerm?: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
  }> {
  assertValidUuid(uuid, 'uuid')

  const limit = 100
  const offset = pageNumber * limit
  // console.log({uuid})
  await psql.connect()

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 4)

  const query = `
    SELECT
      row_number() OVER (ORDER BY p."updatedAt" DESC) + $3 as row_number,
      p.*
    FROM "Photos" p
    INNER JOIN "Watchers" w
      ON p.id = w."photoId"
    WHERE
      w.uuid = $1
    AND p.active = true
    ${searchClause}
    ORDER BY p."updatedAt" DESC
    LIMIT $2
    OFFSET $3
  `

  const results =
  (await psql.query(query, [uuid, limit, offset, ...searchParams])
  ).rows
  await psql.clean()

  // console.log({results})
  // console.log({slicedRezults: results.slice(0, -2) })// remove 2 last elements
  const photos = results.map((photo: any) => plainToClass(Photo, photo))

  let noMoreData = false

  if (photos.length < limit) {
    noMoreData = true
  }

  return {
    photos,
    batch,
    noMoreData
  }
}
