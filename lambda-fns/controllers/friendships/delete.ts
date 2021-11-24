import sql from '../../sql'

import {_deleteChatByChatUuid,} from './_deleteChatByChatUuid'
import {_deleteChatUsersByChatUuid,} from './_deleteChatUsersByChatUuid'
import {_deleteFriendshipByFrienshipUuid,} from './_deleteFriendshipByFrienshipUuid'
import {_deleteMessagesByChatUuid,} from './_deleteMessagesByChatUuid'



export default async function main( friendshipUuid: string) {

  console.log({friendshipUuid,})

  const [chatUuid,] = (await sql`
      SELECT * from "Friendships"
      WHERE "friendshipUuid" = ${friendshipUuid}
  `)

  console.log({chatUuid,})

  const [status,] = await sql.begin(async (sql: any) => {

    await Promise.all([
      _deleteFriendshipByFrienshipUuid(friendshipUuid),

      _deleteChatByChatUuid(chatUuid.chatUuid),
      _deleteChatUsersByChatUuid(chatUuid.chatUuid),
      _deleteMessagesByChatUuid(chatUuid.chatUuid),
    ])
    console.log("OK")
    return ["OK",]
  })

  console.log({status,})
  return "OK"
}
