import sql from '../../sql'
import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'
import Message from '../../models/message'


export default async function main(
  chatUuid: string
) {
  if(uuidValidate(chatUuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const messages = (await sql`SELECT *
      FROM "Messages"
      WHERE "chatUuid" = ${chatUuid}      
      ORDER BY "createdAt" DESC
      LIMIT 10
    `)
  return messages.map((message: Message) => plainToClass(Message, message))
}
