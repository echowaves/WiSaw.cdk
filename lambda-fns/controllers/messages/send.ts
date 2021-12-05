import * as moment from 'moment'

import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Message from '../../models/message'

export default async function main(
  chatUuid: string,
  uuid: string,
  messageUuid: string,
  text: string,
) {

  // here validate values before inserting into DB
  if(uuidValidate(chatUuid) === false ) {
    throw new Error(`Wrong UUID format1`)
  }
  if(uuidValidate(uuid) === false ) {
    throw new Error(`Wrong UUID format2`)
  }
  if(uuidValidate(messageUuid) === false ) {
    throw new Error(`Wrong UUID format3`)
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const message = (await sql`
                      INSERT INTO "Messages"
                      (
                          "chatUuid",
                          "uuid",
                          "messageUuid",
                          "text",
                          "createdAt",
                          "updatedAt"
                      ) values (
                        ${chatUuid},
                        ${uuid},
                        ${messageUuid},
                        ${text},
                        ${createdAt},
                        ${createdAt}
                      )
                      returning *
                      `)[0]

  // console.log({message,})

  return plainToClass(Message, message)
}