import sql from '../../sql'
import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'
import Friendship from '../../models/friendship'


export default async function main(
  chatUuid: string
) {
  if(uuidValidate(chatUuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const friendships = (await sql`SELECT *
      FROM "Friendships"
      WHERE "uuid1" = ${chatUuid}
      OR "uuid2" = ${chatUuid}
    `)
  return friendships.map((friendship: Friendship) => plainToClass(Friendship, friendship))
}
