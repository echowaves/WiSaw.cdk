import * as moment from 'moment'

import {validate as uuidValidate, v4 as uuidv4,} from 'uuid'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Friendship from '../../models/friendship'
import Chat from '../../models/chat'
import ChatUser from '../../models/chatUser'
import Message from '../../models/message'

export default async function main(
  chatUuid: string,
  uuid: string,
  messageUuid: string,
  text: string,
) {

  // here validate values before inserting into DB
  if(uuidValidate(uuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  const friendshipUuid = uuidv4()

  const [friendship, chat, chatUser,] = await sql.begin(async (sql: any) => {

    const [friendship,] = await sql`
                      INSERT INTO "Friendships"
                      (
                        "friendshipUuid",
                        "uuid1",
                        "chatUuid",
                        "createdAt"
                      ) values (
                      ${friendshipUuid},
                      ${uuid},
                      ${chatUuid},
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
                        ${chatUuid},
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
                        ${chatUuid},
                        ${uuid},
                        ${uuid},
                        ${createdAt},
                        ${createdAt}
                      )
                      returning *
                      `

    // console.log({friendship, friend, chat, chatUser,})

    return [friendship, chat, chatUser,]
  })
  // console.log('hohoho')
  // console.log({friendship, friend, chat, chatUser,})


  return 'OK'
}