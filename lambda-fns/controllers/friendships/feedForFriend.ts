import psql from '../../psql'
import { plainToClass } from 'class-transformer'
import Photo from '../../models/photo'
import { assertValidUuid } from '../../utilities/assertValidUuid'
import { buildSearchClause } from '../../utilities/searchClause'

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
    photos: Photo[]
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

  await psql.connect()

  // Validate accepted friendship exists
  const friendship = (await psql.query(`
    SELECT 1 FROM "Friendships"
    WHERE "uuid2" IS NOT NULL
      AND (
        ("uuid1" = $1 AND "uuid2" = $2)
        OR
        ("uuid1" = $2 AND "uuid2" = $1)
      )
    LIMIT 1
  `, [uuid, friendUuid])).rows

  if (friendship.length === 0) {
    throw new Error('No accepted friendship exists between these users')
  }

  const limit = 100
  const offset = pageNumber * limit

  const { clause: searchClause, params: searchParams } = buildSearchClause(searchTerm, 2)

  const query = `
    SELECT
      row_number() OVER (ORDER BY p.${sortField} ${direction}) + ${offset} as row_number,
      p.*
    FROM "Photos" p
    WHERE
      p."uuid" = $1
    AND p.active = true
    ${searchClause}
    ORDER BY p.${sortField} ${direction}
    LIMIT ${limit}
    OFFSET ${offset}
  `

  const results =
  (await psql.query(query, [friendUuid, ...searchParams])
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
