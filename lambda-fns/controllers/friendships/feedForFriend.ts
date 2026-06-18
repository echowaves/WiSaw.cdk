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
  uuid: string,
  friendUuid: string,
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
  assertValidUuid(uuid, 'uuid')
  assertValidUuid(friendUuid, 'friendUuid')

  const sortField = ALLOWED_SORT_FIELDS[sortBy ?? 'updatedAt']
  if (sortField == null) {
    throw new Error('Invalid sort field')
  }
  const direction = ALLOWED_DIRECTIONS[sortDirection ?? 'desc']
  if (direction == null) {
    throw new Error('Invalid sort direction')
  }

  // Validate accepted friendship exists
  const psql = (await import('../../psql')).default
  await psql.connect()
  try {
    const friendshipResult = (await psql.query(
      `SELECT 1 FROM "Friendships"
       WHERE "uuid2" IS NOT NULL
         AND (
           ("uuid1" = $1 AND "uuid2" = $2)
           OR
           ("uuid1" = $2 AND "uuid2" = $1)
         )
       LIMIT 1`,
      [uuid, friendUuid]
    )).rows

    if (friendshipResult.length === 0) {
      throw new Error('No accepted friendship exists between these users')
    }
  } finally {
    await psql.clean()
  }

  const limit = 100
  const offset = pageNumber * limit

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 2)

  const query = `
    SELECT p.*
    FROM "Photos" p
    WHERE
      p."uuid" = $1
    AND p.active = true
    ${searchClause}
    ORDER BY p.${sortField} ${direction}
    LIMIT $2
    OFFSET $3
  `

  return await fetchPaginatedPhotos({
    query,
    params: [friendUuid, limit, offset, ...searchParams],
    pageNumber,
    batchSize: limit,
    batch
  })
}
