import sql from '../../sql'
import {validate as uuidValidate,} from 'uuid'

import {_deleteChatByChatUuid,} from './_deleteChatByChatUuid'
import {_deleteChatUsersByChatUuid,} from './_deleteChatUsersByChatUuid'
import {_deleteFriendshipByFrienshipUuid,} from './_deleteFriendshipByFrienshipUuid'
import {_deleteMessagesByChatUuid,} from './_deleteMessagesByChatUuid'



export default async function main( friendshipUuid: string) {


  // here validate values before inserting into DB
  if(uuidValidate(friendshipUuid) === false) {
    throw new Error(`Wrong UUID format`)
  }
  // console.log({friendshipUuid,})


  const [chatUuid,] = (await sql`
      SELECT * from "Friendships"
      WHERE "friendshipUuid" = ${friendshipUuid}
  `)

  // console.log({chatUuid,})

  const [status,] = await sql.begin(async (sql: any) => {

    await Promise.all([
      _deleteFriendshipByFrienshipUuid(friendshipUuid, sql),

      _deleteChatByChatUuid(chatUuid.chatUuid, sql ),
      _deleteChatUsersByChatUuid(chatUuid.chatUuid, sql ),
      _deleteMessagesByChatUuid(chatUuid.chatUuid, sql ),
    ])
    // console.log("OK")
    return ["OK",]
  })

  // console.log({status,})
  return "OK"
}
