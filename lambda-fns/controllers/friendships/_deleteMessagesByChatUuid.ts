import sql from '../../sql'

export const _deleteMessagesByChatUuid = async( chatUuid: string) => {
  await sql`
    DELETE from "Messages"
    WHERE "chatUuid" = ${chatUuid}"      
  `
  return "OK"
}
