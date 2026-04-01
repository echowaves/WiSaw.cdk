import psql from '../../psql'

import {plainToClass,} from 'class-transformer'
import Friendship from '../../models/friendship'
import Photo from '../../models/photo'
import { assertValidUuid } from '../../utilities/assertValidUuid'


export default async function main(
  uuid: string
) {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const friendships =
  (await psql.query(`
  
  SELECT *
      FROM "Friendships"
      WHERE "uuid1" = $1
      OR "uuid2" = $1
    `, [uuid])
  ).rows

  // Extract friend UUIDs from confirmed friendships
  const friendUuids: string[] = []
  for (const f of friendships) {
    if (f.uuid2 != null) {
      friendUuids.push(f.uuid1 === uuid ? f.uuid2 : f.uuid1)
    }
  }

  // Batch-load up to 5 recent active photos per friend
  const photosByFriend: Record<string, any[]> = {}
  if (friendUuids.length > 0) {
    const photosQuery = `
      SELECT ranked.*
      FROM (
        SELECT "Photos".*,
               ROW_NUMBER() OVER (PARTITION BY "Photos"."uuid" ORDER BY "Photos"."updatedAt" DESC) AS row_num
        FROM "Photos"
        WHERE "Photos"."uuid" = ANY($1)
        AND "Photos"."active" = true
      ) ranked
      WHERE row_num <= 5
    `
    const photosResults = (await psql.query(photosQuery, [friendUuids])).rows
    for (const row of photosResults) {
      if (photosByFriend[row.uuid] == null) {
        photosByFriend[row.uuid] = []
      }
      const photo = plainToClass(Photo, { ...row, row_number: row.row_num })
      photosByFriend[row.uuid].push(photo.toJSON())
    }
  }

  await psql.clean()

  return friendships.map((f: any) => {
    const friendship = plainToClass(Friendship, f)
    const friendUuid = f.uuid1 === uuid ? f.uuid2 : f.uuid1
    ;(friendship as any).photos = friendUuid != null ? (photosByFriend[friendUuid] ?? []) : []
    return friendship
  })
}
