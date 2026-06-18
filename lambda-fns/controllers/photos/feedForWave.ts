import { assertValidUuid } from '../../utilities/assertValidUuid'
import { buildSearchClause } from '../../utilities/searchClause'
import { fetchPaginatedPhotos } from '../../utilities/paginatedPhotos'

const ALLOWED_SORT_FIELDS: Record<string, string> = {
  createdAt: '"createdAt"',
  updatedAt: '"updatedAt"'
}

const ALLOWED_DIRECTIONS: Record<string, string> = {
  asc: 'ASC',
  desc: 'DESC'
}

export default async function main (
  waveUuid: string,
  pageNumber: number,
  batch: string,
  searchTerm?: string,
  sortBy?: string,
  sortDirection?: string
): Promise<{
    photos: any[]
    batch: string
    noMoreData: boolean
    nextPage: number | null
  }> {
  assertValidUuid(waveUuid, 'waveUuid')

  const sortField = ALLOWED_SORT_FIELDS[sortBy ?? 'updatedAt']
  if (sortField == null) {
    throw new Error('Invalid sort field')
  }
  const direction = ALLOWED_DIRECTIONS[sortDirection ?? 'desc']
  if (direction == null) {
    throw new Error('Invalid sort direction')
  }

  const limit = 100
  const offset = pageNumber * limit

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 3)

  const query = `
    SELECT p.*
    FROM "Photos" p
    INNER JOIN "WavePhotos" wp
      ON p.id = wp."photoId"
    WHERE
      wp."waveUuid" = $1
    AND p.active = true
    ${searchClause}
    ORDER BY p.${sortField} ${direction}
    LIMIT $2
    OFFSET $3
  `

  return await fetchPaginatedPhotos({
    query,
    params: [waveUuid, limit, offset, ...searchParams],
    pageNumber,
    batchSize: limit,
    batch
  })
}
