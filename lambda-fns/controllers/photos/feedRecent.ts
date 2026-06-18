import { buildSearchClause } from '../../utilities/searchClause'
import { fetchPaginatedPhotos } from '../../utilities/paginatedPhotos'

export default async function main (
  pageNumber: number,
  batch: string,
  searchTerm?: string
): Promise<{
    photos: any[]
    batch: string
    noMoreData: boolean
    nextPage: number | null
  }> {
  const limit = 20
  const offset = pageNumber * limit

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 2)

  const query = `
    SELECT p.*
    FROM "Photos" p
    WHERE
      active = true
    ${searchClause}
    ORDER BY p."updatedAt" DESC
    LIMIT $1
    OFFSET $2
  `

  return await fetchPaginatedPhotos({
    query,
    params: [limit, offset, ...searchParams],
    pageNumber,
    batchSize: limit,
    batch
  })
}
