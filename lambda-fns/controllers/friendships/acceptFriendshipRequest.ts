import * as moment from 'moment'

import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

// import Friendship from '../../models/friendship'
import Friend from '../../models/friend'
// import Chat from '../../models/chat'

export default async function main(
  uuid: string,
  friendshipUuid: string,
  invitedByUuid: string,
) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  // here validate values before inserting into DB
  if(
    uuidValidate(uuid) === false
  || uuidValidate(friendshipUuid) === false
  || uuidValidate(invitedByUuid) === false ) {
    throw new Error(`Wrong UUID format`)
  }


  const [friend,] = await sql.begin(async (sql: any) => {

    // check how many friends are in the friendship already, can't be more than 1 for the add function to work correctly

    const existingFriends = (await sql`SELECT *
      FROM "Friends"
      WHERE "friendshipUuid" = ${friendshipUuid}
    `)

    if(existingFriends.count === 0) {
      throw new Error(`Friendship does not exist`)
    }
    if(existingFriends.count > 1) {
      throw new Error(`Friendship can't have more than two friends`)
    }

    const friendship = (await sql`SELECT *
      FROM "Friendship"
      WHERE "friendshipUuid" = ${friendshipUuid}
    `)[0]

    const [friend,] = await sql`
                      INSERT INTO "Friends"
                      (
                          "uuid",
                          "friendshipUuid",
                          "createdAt",
                      ) values (    
                        ${uuid},
                        ${friendshipUuid},
                        ${createdAt},
                      )
                      `

    // const [chatUser,] =
    await sql`
                      INSERT INTO "ChatUsers"
                      (
                          "chatUuid",
                          "uuid",
                          "invitedByUuid",
                          "createdAt",
                          "lastReadAt",
                      ) values (    
                        ${friendship.chatUuid},
                        ${uuid},
                        ${invitedByUuid},
                        ${createdAt},
                        ${createdAt},
                      )
                      `

    return [friend,]
  })

  return plainToClass(Friend, friend)
}