import dayjs, { type Dayjs } from 'dayjs'

import { v4 as uuidv4 } from "uuid"

import { plainToClass } from "class-transformer"

import psql from "../../psql"

import Friendship from "../../models/friendship"
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main(uuid: string) {
  // here validate values before inserting into DB
  assertValidUuid(uuid, 'uuid')

  const createdAt = dayjs().toISOString()

  const friendshipUuid = uuidv4()

  await psql.connect()

  const friendship = (
    await psql.query(`      
                    INSERT INTO "Friendships"
                    (
                      "friendshipUuid",
                      "uuid1",
                      "createdAt"
                    ) values (
                    $1,
                    $2,
                    $3
                    ) 
                    returning *
                    `, [friendshipUuid, uuid, createdAt])
  ).rows[0]

  await psql.clean()

  return plainToClass(Friendship, friendship)
}
