import psql from "../../psql"

import { validate as uuidValidate } from "uuid"

import { plainToClass } from "class-transformer"
import Message from "../../models/message"

export default async function main(chatUuid: string, lastLoaded: string) {
  const limit = 20

  if (uuidValidate(chatUuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  await psql.connect()

  const messages = (
    await psql.query(`
  SELECT *
      FROM "Messages"
      WHERE 
        "chatUuid" = '${chatUuid}'
      AND
        "createdAt" < '${lastLoaded}'
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
      `)
  ).rows

  await psql.clean()

  return messages.map((message: Message) => plainToClass(Message, message))
}
