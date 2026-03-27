import psql from '../../psql'

import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'
import Friendship from '../../models/friendship'


export default async function main(
  uuid: string
) {
  if(uuidValidate(uuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

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
