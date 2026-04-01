import psql from '../../psql'

import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main( friendshipUuid: string) {
  // here validate values before inserting into DB
  assertValidUuid(friendshipUuid, 'friendshipUuid')

  await psql.connect()

  await psql.query(`      
    DELETE from "Friendships"
      WHERE "friendshipUuid" = $1
  `, [friendshipUuid])

  await psql.clean()

  return "OK"
}
