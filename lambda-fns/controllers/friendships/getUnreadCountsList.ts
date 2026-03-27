import psql from '../../psql'

import { assertValidUuid } from '../../utilities/assertValidUuid'

// import {plainToClass,} from 'class-transformer'
// import Friendship from '../../models/friendship'


export default async function main(
  uuid: string
) {
  assertValidUuid(uuid, 'uuid')

  await psql.connect()

  const unreadCounts =
  (await psql.query(`
          SELECT
            cu."chatUuid",
            cu."updatedAt",
            COUNT(CASE WHEN m."createdAt" > cu."lastReadAt" THEN 1 END) AS unread
          FROM "ChatUsers" cu 
            INNER JOIN "Messages" m ON cu."chatUuid" = m."chatUuid"
          WHERE cu."uuid" =  $1
          GROUP BY cu."chatUuid", cu."updatedAt"
      `, [uuid])).rows

  await psql.clean()

  return unreadCounts
}
