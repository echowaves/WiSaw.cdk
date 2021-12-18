import * as moment from 'moment'

import {validate as uuidValidate,} from 'uuid'

// import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

// import Message from '../../models/message'

export default async function main(
  chatUuid: string,
  uuid: string,
) {

  // here validate values before inserting into DB
  if(uuidValidate(chatUuid) === false ) {
    throw new Error(`Wrong UUID format1`)
  }
  if(uuidValidate(uuid) === false ) {
    throw new Error(`Wrong UUID format2`)
  }

  const lastReadAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  const [chatUsers,] = await sql`
                      UPDATE "ChatUsers"
                      SET "lastReadAt" = ${lastReadAt}       
                      WHERE 
                        "chatUuid" = ${chatUuid}
                      AND
                        "uuid" = ${uuid} 
                      returning *
                      `
  // console.log({message,})

  return lastReadAt
}