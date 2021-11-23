import * as moment from 'moment'

import {validate as uuidValidate, v4 as uuidv4,} from 'uuid'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Friendship from '../../models/friendship'
import Friend from '../../models/friend'
import Chat from '../../models/chat'
import ChatUser from '../../models/chatUser'

export default async function main(uuid: string) {

  // here validate values before inserting into DB
  if(uuidValidate(uuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  const friendshipUuid = uuidv4()
  // const chatUuid = uuidv4()

  const [friendship, friend, chat, chatUser,] = await sql.begin(async (sql: any) => {

    const [friendship,] = await sql`
                      INSERT INTO "Friendships"
                      (
                        "friendshipUuid",
                        "chatUuid",
                        "createdAt"
                      ) values (
                      ${friendshipUuid},
                      ${friendshipUuid},
                      ${createdAt}
                      ) 
                      returning *
                      `


    const [friend,] = await sql`
                      INSERT INTO "Friends"
                      (
                          "uuid",
                          "friendshipUuid",
                          "createdAt"
                      ) values (
                        ${uuid},
                        ${friendshipUuid},
                        ${createdAt}
                      )
                      returning *
                      `

    const [chat,] = await sql`
                      INSERT INTO "Chats"
                      (
                          "chatUuid",
                          "createdAt"
                      ) values (
                        ${friendshipUuid},
                        ${createdAt}
                      )
                      returning *
                      `

    const [chatUser,] = await sql`
                      INSERT INTO "ChatUsers"
                      (
                          "chatUuid",
                          "uuid",
                          "invitedByUuid",
                          "createdAt",
                          "lastReadAt"
                      ) values (
                        ${friendshipUuid},
                        ${uuid},
                        ${uuid},
                        ${createdAt},
                        ${createdAt}
                      )
                      returning *
                      `

    // console.log({friendship, friend, chat, chatUser,})

    return [friendship, friend, chat, chatUser,]
  })
  // console.log('hohoho')
  // console.log({friendship, friend, chat, chatUser,})


  return {
    friendship:plainToClass(Friendship, friendship),
    friend: plainToClass(Friend, friend),
    chat: plainToClass(Chat, chat),
    chatUser:plainToClass(ChatUser, chatUser),
  }
}