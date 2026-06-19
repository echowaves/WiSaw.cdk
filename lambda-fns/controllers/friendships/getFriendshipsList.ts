import psql from '../../psql'

import { plainToClass } from 'class-transformer'
import Friendship from '../../models/friendship'
import Photo from '../../models/photo'
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main (
  uuid: string
): Promise<{
    friendships: any[]
    friendUuids: string[]
    photosByFriend: Record<string, any[]>
    countsByFriend: Record<string, number>
  }> {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const friendships =
  (await psql.query(`
    
    SELECT DISTINCT ON (LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2)) *
        FROM "Friendships"
        WHERE "uuid1" = $1
        OR "uuid2" = $1
        ORDER BY LEAST(uuid1, uuid2), GREATEST(uuid1, uuid2), "createdAt" DESC
      `, [uuid])
  ).rows

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
