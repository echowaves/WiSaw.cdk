import moment from "moment"

import { validate as uuidValidate } from "uuid"

import { plainToClass } from "class-transformer"

import psql from "../../psql"

import Chat from "../../models/chat"
import ChatUser from "../../models/chatUser"
import Friendship from "../../models/friendship"

export default async function main(friendshipUuid: string, uuid: string) {
  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  // here validate values before inserting into DB
  if (uuidValidate(uuid) === false || uuidValidate(friendshipUuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  // console.log({ friendshipUuid, uuid })
  await psql.connect()

  const [friendship, chat, chatUser] = await (async (): Promise<any> => {
    try {
      await psql.query("BEGIN")

      // check how many friends are in the friendship already, can't be more than 1 for the add function to work correctly
      const friendship1 = (
        await psql.query(`
          SELECT *
          FROM "Friendships"
          WHERE "friendshipUuid" = $1
        `, [friendshipUuid])
      ).rows

      // console.log({friendship1,})

      if (friendship1.length === 0) {
        throw new Error(`Friendship not found`)
      }

      // console.log({ friendship1: friendship1[0] })

      if (friendship1[0].uuid2 !== null) {
        throw new Error(`Friendship already confirmed`)
      }

      const friendship = (
        await psql.query(`
                            UPDATE "Friendships"
                            SET "uuid2" = $1
                            WHERE "friendshipUuid" = $2
                            returning *
                            `, [uuid, friendshipUuid])
      ).rows[0]

      // console.log({ friendship })

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
                              $1,
                              $2,
                              $3,
                              $4,
                              $4
                            )
                            returning *
                            `, [friendship.chatUuid, uuid, friendship.uuid1, createdAt])
      ).rows[0]

      // console.log({ chatUser })

      const chat = (
        await psql.query(`
                      SELECT * FROM "Chats"
                      WHERE                   
                          "chatUuid" = $1
                      `, [friendship.chatUuid])
      ).rows[0]

      // console.log({ chat })

      await psql.query("COMMIT")
      return [friendship, chat, chatUser]
    } catch (e) {
      console.error(e)
      await psql.query("ROLLBACK")
      throw "unable to accept friendship request"
    }
  })()

  await psql.clean()

  return {
    friendship: plainToClass(Friendship, friendship),
    chat: plainToClass(Chat, chat),
    chatUser: plainToClass(ChatUser, chatUser),
  }
}
