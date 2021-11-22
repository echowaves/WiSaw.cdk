import * as moment from 'moment'

import {validate as uuidValidate, v4 as uuidv4,} from 'uuid'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Friendship from '../../models/friendship'
import Friend from '../../models/friend'
import Chat from '../../models/chat'

export default async function main(
  uuid: string,
  friendshipUuid: string,
) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  const chatUuid = uuidv4()

  // here validate values before inserting into DB
  if(uuidValidate(uuid) === false) {
    throw new Error(`Wrong UUID format`)
  }


  const [friendship, friend, chat,] = await sql.begin(async (sql: any) => {

    const [friendship,] = await sql`
                      INSERT INTO "Friendships"
                      (
                        "friendshipUuid",
                        "chatUuid",
                        "createdAt",
                      ) values (
                      ${friendshipUuid},
                      ${chatUuid},
                      ${createdAt},
                      )
                      `


    const [friend,] = await sql`
                      INSERT INTO "Friends"
                      (
                          "uuid",
                          "createdAt",
                      ) values (    
                        ${uuid},
                        ${createdAt},
                      )
                      `

    const [chat,] = await sql`
                      INSERT INTO "Chats"
                      (
                          "uuid",
                          "createdAt",
                      ) values (    
                        ${chatUuid},
                        ${createdAt},
                      )
                      `

    return [friendship, friend, chat,]
  })

  return [plainToClass(Friendship, friendship), plainToClass(Friend, friend), plainToClass(Chat, chat), ]
}