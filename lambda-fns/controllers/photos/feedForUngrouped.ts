import { assertValidUuid } from '../../utilities/assertValidUuid'
import { buildSearchClause } from '../../utilities/searchClause'
import { fetchPaginatedPhotos } from '../../utilities/paginatedPhotos'

export default async function main (
  uuid: string,
  pageNumber: number,
  batch: string,
  searchTerm?: string
): Promise<{
    photos: any[]
    batch: string
    noMoreData: boolean
    nextPage: number | null
  }> {
  assertValidUuid(uuid, 'uuid')

  const limit = 100
  const offset = pageNumber * limit

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 3)

  const query = `
    SELECT p.*
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
    OFFSET $3
  `

  return await fetchPaginatedPhotos({
    query,
    params: [uuid, limit, offset, ...searchParams],
    pageNumber,
    batchSize: limit,
    batch
  })
}
