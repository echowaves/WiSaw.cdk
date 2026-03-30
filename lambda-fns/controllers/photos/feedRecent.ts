import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'
import { buildSearchClause } from '../../utilities/searchClause'

// import AbuseReport from '../../models/abuseReport'

export default async function main (
  pageNumber: number,
  batch: string,
  searchTerm?: string
): Promise<{
    photos: Photo[]
    batch: string
    noMoreData: boolean
    nextPage: number | null
  }> {
  const limit = 20
  const offset = pageNumber * limit
  // console.log({uuid})
  await psql.connect()

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 3)

  const query = `
    SELECT
      p.*
    FROM "Photos" p
    WHERE
      active = true
    ${searchClause}
    ORDER BY p."updatedAt" DESC
    LIMIT $1
    OFFSET $2
  `

  const results =
  (await psql.query(query, [limit, offset, ...searchParams])
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
    noMoreData,
    nextPage: noMoreData ? null : pageNumber + 1
  }
}
