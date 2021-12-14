import sql from '../../sql'
import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'
import Message from '../../models/message'


export default async function main(
  chatUuid: string,
  lastLoaded: string,
) {
  const limit = 20

  if(uuidValidate(chatUuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const messages = (await sql`SELECT *
      FROM "Messages"
      WHERE 
        "chatUuid" = ${chatUuid}      
      AND
        "createdAt" < ${lastLoaded}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `)
  return messages.map((message: Message) => plainToClass(Message, message))
}
