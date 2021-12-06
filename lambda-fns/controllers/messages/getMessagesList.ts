import sql from '../../sql'
import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'
import Message from '../../models/message'


export default async function main(
  chatUuid: string,
  pageNumber: number = 0,
) {
  const limit = 20
  const offset = pageNumber * limit
  if(uuidValidate(chatUuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const messages = (await sql`SELECT *
      FROM "Messages"
      WHERE "chatUuid" = ${chatUuid}      
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `)
  return messages.map((message: Message) => plainToClass(Message, message))
}
