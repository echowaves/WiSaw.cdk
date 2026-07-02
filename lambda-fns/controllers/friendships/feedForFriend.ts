import { assertValidUuid } from '../../utilities/assertValidUuid'
import { buildSearchClause } from '../../utilities/searchClause'
import { fetchPaginatedPhotos } from '../../utilities/paginatedPhotos'

export default async function main (
  uuid: string,
  friendUuid: string,
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
  assertValidUuid(friendUuid, 'friendUuid')

  // Reject self-feed
  if (uuid === friendUuid) {
    throw new Error('Cannot fetch feed for self')
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

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 3)

  const query = `
    SELECT p.*
    FROM "Photos" p
    WHERE
      p.uuid = $1
    AND p.active = true
    ${searchClause}
    ORDER BY p."updatedAt" DESC
    LIMIT $2
    OFFSET $3
  `

  const result = await fetchPaginatedPhotos({
    query,
    params: [friendUuid, limit, offset, ...searchParams],
    pageNumber,
    batchSize: limit,
    batch
  })

  return result
}
