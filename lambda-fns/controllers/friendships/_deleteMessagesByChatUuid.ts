export const _deleteMessagesByChatUuid = async( chatUuid: string, sql: any) => {
  await sql`
    DELETE from "Messages"
    WHERE "chatUuid" = ${chatUuid}
  `
  return "OK"
}
