import sql from '../../sql'
import {validate as uuidValidate,} from 'uuid'

// import {plainToClass,} from 'class-transformer'
// import Friendship from '../../models/friendship'


export default async function main(
  uuid: string
) {
  if(uuidValidate(uuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const unreadCounts = (await sql`
  SELECT
    cu."chatUuid",
    cu."updatedAt",
    COUNT(CASE WHEN m."createdAt" > cu."lastReadAt" THEN 1 END) AS unread
  FROM "ChatUsers" cu 
    INNER JOIN "Messages" m ON cu."chatUuid" = m."chatUuid"
  WHERE cu."uuid" =  ${uuid}
  GROUP BY cu."chatUuid", cu."updatedAt"
      `)
  return unreadCounts
}
