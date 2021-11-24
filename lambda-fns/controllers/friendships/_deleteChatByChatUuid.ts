export const _deleteChatByChatUuid = async( chatUuid: string, sql: any) => {
  await sql`
      DELETE from "Chats"
      WHERE "chatUuid" = ${chatUuid} 
    `
  return "OK"
}
