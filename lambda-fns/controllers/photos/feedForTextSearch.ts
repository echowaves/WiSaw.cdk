import { buildSearchClause } from '../../utilities/searchClause'
import { fetchPaginatedPhotos } from '../../utilities/paginatedPhotos'

export default async function main (
  searchTerm: string,
  pageNumber: number,
  batch: string
): Promise<{
    photos: any[]
    batch: string
    noMoreData: boolean
    nextPage: number | null
  }> {
  const limit = 100
  const offset = pageNumber * limit

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 3)

  const query = `
    SELECT p.*
    FROM "Photos" p
    WHERE active = true
      ${searchClause}
    ORDER BY id desc
    LIMIT $1
    OFFSET $2
  `

  return await fetchPaginatedPhotos({
    query,
    params: [limit, offset, ...searchParams],
    pageNumber,
    batchSize: limit,
    noMoreDataOverride: true,
    batch
  })
}
