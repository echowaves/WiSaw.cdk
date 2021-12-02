import * as moment from 'moment'

import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Friendship from '../../models/friendship'
import Chat from '../../models/chat'
import ChatUser from '../../models/chatUser'

export default async function main(
  friendshipUuid: string,
  uuid: string,
) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  // here validate values before inserting into DB
  if(
    uuidValidate(uuid) === false
  || uuidValidate(friendshipUuid) === false
  ) {
    throw new Error(`Wrong UUID format`)
  }

  console.log({friendshipUuid, uuid,})

  const [friendship,chat,chatUser,] = await sql.begin(async (sql: any) => {

    // check how many friends are in the friendship already, can't be more than 1 for the add function to work correctly
    const friendship1 = (await sql`SELECT *
      FROM "Friendships"
      WHERE "friendshipUuid" = ${friendshipUuid}
    `)

    console.log({friendship1,})

    if(friendship1.count === 0) {
      throw new Error(`Friendship not found`)
    }

    console.log({friendship1:friendship1[0] ,})

    if(friendship1[0].uuid2 !== null) {
      throw new Error(`Friendship already confirmed`)
    }

    const [friendship,] = await sql`
                      UPDATE "Friendships"
                      SET "uuid2" = ${uuid}
                      WHERE "friendshipUuid" = ${friendshipUuid}
                      returning *
                      `
    console.log({friendship,})

    const [chatUser,] =
    await sql`
                      INSERT INTO "ChatUsers"
                      (
                          "chatUuid",
                          "uuid",
                          "invitedByUuid",
                          "createdAt",
                          "lastReadAt"
                      ) values (    
                        ${friendship.chatUuid},
                        ${uuid},
                        ${friendship.uuid1},
                        ${createdAt},
                        ${createdAt}
                      )
                      returning *
                      `
    console.log({chatUser,})

    const [chat,] = await sql`
                      SELECT FROM "Chats"
                      WHERE                   
                          "chatUuid" = ${friendship.chatUuid}
                      returning *
                      `

    console.log({chat,})

    return [friendship,chat,chatUser,]
  })

  return {
    friendship:plainToClass(Friendship, friendship),
    chat: plainToClass(Chat, chat),
    chatUser:plainToClass(ChatUser, chatUser),
  }
}