import sql from '../../sql'

export const _deleteChatByChatUuid = async( chatUuid: string) => {
  await sql`
      DELETE from "Chats"
      WHERE "chatUuid" = ${chatUuid}"      
    `
  return "OK"
}
