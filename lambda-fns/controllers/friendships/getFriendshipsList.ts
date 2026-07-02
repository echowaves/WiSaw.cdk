import psql from '../../psql'

import { plainToClass } from 'class-transformer'
import Friendship from '../../models/friendship'
import Photo from '../../models/photo'
import { assertValidUuid } from '../../utilities/assertValidUuid'

const ALLOWED_SORT_FIELDS: Record<string, string> = {
  recentPhoto: '(SELECT MAX(p."updatedAt") FROM "Photos" p WHERE p."uuid" = friend_uuid)'
}

const ALLOWED_DIRECTIONS: Record<string, string> = {
  asc: 'ASC',
  desc: 'DESC'
}

export default async function main (
  uuid: string,
  sortBy?: string,
  sortDirection?: string
): Promise<Friendship[]> {
  assertValidUuid(uuid, 'uuid')

  const sortField = ALLOWED_SORT_FIELDS[sortBy ?? '']
  if ((sortBy != null && sortBy !== '') && sortField == null) {
    throw new Error('Invalid sort field')
  }
  const direction = ALLOWED_DIRECTIONS[sortDirection ?? 'desc']
  if (direction == null) {
    throw new Error('Invalid sort direction')
  }

  await psql.connect()

  let friendships: any[] = []
  if (sortBy === 'recentPhoto') {
    // Use a subquery to get friend UUIDs and their last photo date
    const recentPhotoQuery = `
      WITH friend_data AS (
        SELECT 
          DISTINCT ON (LEAST(f.uuid1, f.uuid2), GREATEST(f.uuid1, f.uuid2))
          f.*,
          CASE 
            WHEN f.uuid1 = $1 THEN f.uuid2
            ELSE f.uuid1
          END AS friend_uuid
        FROM "Friendships" f
        WHERE f.uuid1 = $1 OR f.uuid2 = $1
      )
      SELECT fd.*, 
             (SELECT MAX(p."updatedAt") FROM "Photos" p WHERE p."uuid" = fd.friend_uuid) AS last_photo_at
      FROM friend_data fd
      WHERE fd.uuid2 IS NOT NULL AND fd.uuid1 != fd.uuid2
      ORDER BY last_photo_at ${direction}, fd."createdAt" DESC
    `
    friendships = (await psql.query(recentPhotoQuery, [uuid])).rows
  } else {
    // Default ordering
    const defaultQuery = `
      SELECT DISTINCT ON (LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2)) *
      FROM "Friendships"
      WHERE "uuid1" = $1 OR "uuid2" = $1
      ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC
    `
    friendships = (await psql.query(defaultQuery, [uuid])).rows
  }

  // Extract friend UUIDs from confirmed friendships
  const friendUuids: string[] = []
  for (const f of friendships) {
    if (f.uuid2 != null) {
      // Skip self-friendships
      if (f.uuid1 === f.uuid2) {
        continue
      }
      friendUuids.push(f.uuid1 === uuid ? f.uuid2 : f.uuid1)
    }
  }

  // Batch-load up to 5 recent active photos AND counts per friend
  const photosByFriend: Record<string, any[]> = {}
  const countsByFriend: Record<string, number> = {}
  if (friendUuids.length > 0) {
    const photosQuery = `
      SELECT sub.*, cnt.friend_photo_count
      FROM (
        SELECT ranked.*,
               COUNT(*) OVER (PARTITION BY "uuid") AS friend_photo_count
        FROM (
          SELECT "Photos".*,
                 ROW_NUMBER() OVER (PARTITION BY "Photos"."uuid" ORDER BY "Photos"."updatedAt" DESC) AS row_num
          FROM "Photos"
          WHERE "Photos"."uuid" = ANY($1)
          AND "Photos"."active" = true
         ) ranked
        WHERE row_num <= 5
       ) sub
      JOIN (
        SELECT "uuid", COUNT(*) AS friend_photo_count
        FROM "Photos"
        WHERE "uuid" = ANY($1)
        AND "active" = true
        GROUP BY "uuid"
       ) cnt ON sub.uuid = cnt.uuid
      `
    const photosResults = (await psql.query(photosQuery, [friendUuids])).rows
    for (const row of photosResults) {
      const friendUuid = row.uuid
      if (photosByFriend[friendUuid] == null) {
        photosByFriend[friendUuid] = []
        countsByFriend[friendUuid] = row.friend_photo_count ?? 0
      }
      const photo = plainToClass(Photo, { ...row, row_number: row.row_num })
      photosByFriend[friendUuid].push(photo.toJSON())
    }
  }

  await psql.clean()

  return friendships.map((f: any) => {
    const friendship = plainToClass(Friendship, f)
    const friendUuid = f.uuid1 === uuid ? f.uuid2 : f.uuid1
    ;(friendship as any).photos = friendUuid != null ? (photosByFriend[friendUuid] ?? []) : []
    ;(friendship as any).photosCount = friendUuid != null ? (countsByFriend[friendUuid] ?? 0) : 0
    return friendship
  })
}
