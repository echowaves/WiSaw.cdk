import psql from "../../psql"

import { plainToClass } from "class-transformer"
import Message from "../../models/message"
import { assertValidUuid } from '../../utilities/assertValidUuid'

export default async function main(chatUuid: string, lastLoaded: string) {
  const limit = 20

  assertValidUuid(chatUuid, 'chatUuid')

  await psql.connect()

  const messages = (
    await psql.query(`
  SELECT *
      FROM "Messages"
      WHERE 
        "chatUuid" = $1
      AND
        "createdAt" < $2
      ORDER BY "createdAt" DESC
      LIMIT $3
      `, [chatUuid, lastLoaded, limit])
  ).rows

  await psql.clean()

  return messages.map((message: Message) => plainToClass(Message, message))
}
