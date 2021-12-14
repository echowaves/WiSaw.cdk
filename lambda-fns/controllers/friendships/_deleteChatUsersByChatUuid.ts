export const _deleteChatUsersByChatUuid = async( chatUuid: string, sql: any) => {
  await sql`
      DELETE from "ChatUsers"
      WHERE "chatUuid" = ${chatUuid}
  `
  return "OK"
}
