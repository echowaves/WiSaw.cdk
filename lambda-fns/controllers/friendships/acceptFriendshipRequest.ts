import { plainToClass } from "class-transformer"

import psql from "../../psql"

import Friendship from "../../models/friendship"
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main(friendshipUuid: string, uuid: string) {
  // here validate values before inserting into DB
  assertValidUuid(uuid, 'uuid')
  assertValidUuid(friendshipUuid, 'friendshipUuid')

  await psql.connect()

  const existing = (
    await psql.query(`
      SELECT *
      FROM "Friendships"
      WHERE "friendshipUuid" = $1
    `, [friendshipUuid])
  ).rows

  if (existing.length === 0) {
    await psql.clean()
    throw new Error(`Friendship not found`)
  }

  if (existing[0].uuid2 !== null) {
    await psql.clean()
    throw new Error(`Friendship already confirmed`)
  }

  if (existing[0].uuid1 === uuid) {
    await psql.clean()
    throw new Error(`Cannot accept self-friendship`)
  }

  const friendship = (
    await psql.query(`
                        UPDATE "Friendships"
                        SET "uuid2" = $1
                        WHERE "friendshipUuid" = $2
                        returning *
                        `, [uuid, friendshipUuid])
  ).rows[0]

  await psql.clean()

  return plainToClass(Friendship, friendship)
}
