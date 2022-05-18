import psql from '../../psql'

import {validate as uuidValidate,} from 'uuid'

export default async function main( friendshipUuid: string) {
  // console.log({friendshipUuid,})
  // here validate values before inserting into DB
  if(uuidValidate(friendshipUuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  await psql.connect()

  const chatUuid =
        (await psql.query(`      
      SELECT * from "Friendships"
      WHERE "friendshipUuid" = '${friendshipUuid}'
  `)).rows[0].chatUuid

  console.log({chatUuid,})

  try {
    await psql.query('BEGIN')

    await psql.query(`      
      DELETE from "Friendships"
        WHERE "friendshipUuid" = '${friendshipUuid}'
    `)

    await psql.query(`      
      DELETE from "Chats"
        WHERE "chatUuid" = '${chatUuid}'
    `)

    await psql.query(`      
      DELETE from "ChatUsers"
        WHERE "chatUuid" = '${chatUuid}'
    `)

    await psql.query(`      
      DELETE from "Messages"
        WHERE "chatUuid" = '${chatUuid}'
    `)
    // console.log("OK")
    await psql.query('COMMIT')

  } catch (e) {
    console.error(e)
    await psql.query('ROLLBACK')
    throw('unable to accept friendship request')
  }


  await psql.clean()

  // console.log({status,})
  return "OK"
}
