import * as moment from 'moment'

import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Message from '../../models/message'

export default async function main(
  chatUuidArg: string,
  uuidArg: string,
  messageUuidArg: string,
  textArg: string,
): Promise<Message> {

  // here validate values before inserting into DB
  if(uuidValidate(chatUuidArg) === false ) {
    throw new Error(`Wrong UUID format1`)
  }
  if(uuidValidate(uuidArg) === false ) {
    throw new Error(`Wrong UUID format2`)
  }
  if(uuidValidate(messageUuidArg) === false ) {
    throw new Error(`Wrong UUID format3`)
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const message =
   (await sql`
              INSERT INTO "Messages"
              (
                  "chatUuid",
                  "uuid",
                  "messageUuid",
                  "text",
                  "pending", 
                  "createdAt",
                  "updatedAt"
              ) values (
                ${chatUuidArg},
                ${uuidArg},
                ${messageUuidArg},
                ${textArg},
                ${false}, 
                ${createdAt},
                ${createdAt}
              )
              returning *
              `)[0]

  await sql`
            UPDATE "ChatUsers"
            SET "updatedAt" = ${createdAt}
            WHERE "chatUuid" = ${chatUuidArg}
            returning *`

  // console.log({message,})

  return plainToClass(Message, message)
}