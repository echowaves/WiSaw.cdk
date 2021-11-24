import sql from '../../sql'
import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'
import Friendship from '../../models/friendship'


export default async function main(
  uuid: string
) {
  if(uuidValidate(uuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const friendships = (await sql`SELECT *
      FROM "Friendships"
      WHERE "uuid1" = ${uuid}
      OR "uuid2" = ${uuid}
    `)
  return friendships.map((friendship: Friendship) => plainToClass(Friendship, friendship))
}
