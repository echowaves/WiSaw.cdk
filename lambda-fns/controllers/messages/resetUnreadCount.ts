import moment from "moment"

import psql from "../../psql"
import { assertValidUuid } from '../../utilities/assertValidUuid'

// import {plainToClass,} from 'class-transformer'



// import Message from '../../models/message'

export default async function main(chatUuid: string, uuid: string) {
  // here validate values before inserting into DB
  assertValidUuid(chatUuid, 'chatUuid')
  assertValidUuid(uuid, 'uuid')

  const lastReadAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  await psql.connect()

  // const chatUsers =
  await psql.query(`
                      UPDATE "ChatUsers"
                      SET "lastReadAt" = $1       
                      WHERE 
                        "chatUuid" = $2
                      AND
                        "uuid" = $3 
                      returning *
                      `, [lastReadAt, chatUuid, uuid])
  // ).rows[0]
  await psql.clean()

  // console.log({message,})

  return lastReadAt
}
