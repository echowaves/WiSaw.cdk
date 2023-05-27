import moment from "moment"

import { validate as uuidValidate, v4 as uuidv4 } from "uuid"

import { plainToClass } from "class-transformer"

import psql from "../../psql"

import Friendship from "../../models/friendship"
import Chat from "../../models/chat"
import ChatUser from "../../models/chatUser"

export default async function main(uuid: string) {
  // here validate values before inserting into DB
  if (uuidValidate(uuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  const friendshipUuid = uuidv4()
  const chatUuid = uuidv4()

  await psql.connect()

  try {
    await psql.query("BEGIN")

    const friendship = (
      await psql.query(`      
                      INSERT INTO "Friendships"
                      (
                        "friendshipUuid",
                        "uuid1",
                        "chatUuid",
                        "createdAt"
                      ) values (
                      '${friendshipUuid}',
                      '${uuid}',
                      '${chatUuid}',
                      '${createdAt}'
                      ) 
                      returning *
                      `)
    ).rows[0]

    const chat = (
      await psql.query(`      
                      INSERT INTO "Chats"
                      (
                          "chatUuid",
                          "createdAt"
                      ) values (
                        '${chatUuid}',
                        '${createdAt}'
                      )
                      returning *
                      `)
    ).rows[0]

    const chatUser = (
      await psql.query(`      
                      INSERT INTO "ChatUsers"
                      (
                          "chatUuid",
                          "uuid",
                          "invitedByUuid",
                          "createdAt",
                          "lastReadAt"
                      ) values (
                        '${chatUuid}',
                        '${uuid}',
                        '${uuid}',
                        '${createdAt}',
                        '${createdAt}'
                      )
                      returning *
                      `)
    ).rows[0]

    await psql.query("COMMIT")
    await psql.clean()
    // console.log({friendship, friend, chat, chatUser,})
    return {
      friendship: plainToClass(Friendship, friendship),
      chat: plainToClass(Chat, chat),
      chatUser: plainToClass(ChatUser, chatUser),
    }
  } catch (e) {
    console.error(e)
    await psql.query("ROLLBACK")
    await psql.clean()
    throw "unable to create friendship"
  }
}
