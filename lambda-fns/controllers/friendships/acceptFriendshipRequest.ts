import * as moment from 'moment'

import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Friendship from '../../models/friendship'
// import Chat from '../../models/chat'

export default async function main(
  uuid: string,
  friendshipUuid: string,
) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  // here validate values before inserting into DB
  if(
    uuidValidate(uuid) === false
  || uuidValidate(friendshipUuid) === false
  ) {
    throw new Error(`Wrong UUID format`)
  }


  const [friendship,] = await sql.begin(async (sql: any) => {

    // check how many friends are in the friendship already, can't be more than 1 for the add function to work correctly
    const [friendship,] = (await sql`SELECT *
      FROM "Friendship"
      WHERE "friendshipUuid" = ${friendshipUuid}
    `)

    if(friendship.uuid2 !== null) {
      throw new Error(`Friendship already confirmed`)
    }

    const [confirmedFriendship,] = await sql`
                      UPDATE "Friendship"
                      SET "uuid2" = ${uuid}
                      WHERE "friendshipUuid" = ${friendshipUuid}
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
                        ${friendship.uuid1},
                        ${createdAt},
                        ${createdAt},
                      )
                      `

    return [confirmedFriendship,]
  })

  return plainToClass(Friendship, friendship)
}