import moment from "moment"

import { validate as uuidValidate } from "uuid"

import { plainToClass } from "class-transformer"

import psql from "../../psql"

import Message from "../../models/message"

export default async function main(
  chatUuidArg: string,
  uuidArg: string,
  messageUuidArg: string,
  textArg: string,
  pendingArg: boolean,
  chatPhotoHashArg: string,
): Promise<Message> {
  // 1. if the message with this messageUuid  does not exists -- it's a new message, then intert
  // 2. otherwise update the existing ,message

  // here validate values before inserting into DB
  if (uuidValidate(chatUuidArg) === false) {
    throw new Error(`Wrong UUID format1`)
  }
  if (uuidValidate(uuidArg) === false) {
    throw new Error(`Wrong UUID format2`)
  }
  if (uuidValidate(messageUuidArg) === false) {
    throw new Error(`Wrong UUID format3`)
  }

  if (pendingArg !== true && pendingArg !== false) {
    throw new Error(`Pending value should be passed in`)
  }

  if (chatPhotoHashArg === null || chatPhotoHashArg === undefined) {
    throw new Error(
      `chatPhotoHashArg value should be passed in even if it's empty string`,
    )
  }

  const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")

  // let's check if this message already exists, then we will update it

  await psql.connect()
  const existingMessages = (
    await psql.query(`
  SELECT *
    FROM "Messages"
    WHERE "messageUuid" = '${messageUuidArg}'
  `)
  ).rows

  if (existingMessages.length > 1) {
    await psql.clean()
    throw new Error(
      `Potentially duplicate messages --> messageUuid:${messageUuidArg}`,
    )
  }

  let message = null
  // this is brand new message --> insert
  if (existingMessages.length === 0) {
    message = (
      await psql.query(`
    INSERT INTO "Messages"
               (
                   "chatUuid",
                   "uuid",
                   "messageUuid",
                   "text",
                   "pending", 
                   "chatPhotoHash"
               ) values (
                 '${chatUuidArg}',
                 '${uuidArg}',
                 '${messageUuidArg}',
                 '${textArg}',
                 ${pendingArg}, 
                 '${chatPhotoHashArg}'
               )
               returning *
               `)
    ).rows[0]
  } else {
    // this is not a new message --> update
    // "chatUuid", "uuid", "messageUuid" are nor going to be updated even if the different values passed in -- they will be ignored
    message = (
      await psql.query(`
               UPDATE "Messages"
               SET
                   "text" = '${textArg}', 
                   "pending" = ${pendingArg},
                   "chatPhotoHash" = '${chatPhotoHashArg}'
               WHERE
                    "messageUuid" = '${messageUuidArg}'
               returning *
               `)
    ).rows[0]
  }

  await psql.query(`
    UPDATE "ChatUsers"
            SET "updatedAt" = '${updatedAt}'
            WHERE "chatUuid" = '${chatUuidArg}'
            returning *`)
  // console.log({message,})
  await psql.clean()

  return plainToClass(Message, message)
}
