import psql from '../../psql'

import {plainToClass,} from 'class-transformer'
import Friendship from '../../models/friendship'
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
  await psql.clean()

  return friendships.map((friendship: Friendship) => plainToClass(Friendship, friendship))
}
