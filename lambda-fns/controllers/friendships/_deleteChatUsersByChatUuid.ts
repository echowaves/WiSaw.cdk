
import sql from '../../sql'


export const _deleteChatUsersByChatUuid = async( chatUuid: string) => {
  await sql`
      DELETE from "ChatUsers"
      WHERE "chatUuid" = ${chatUuid}"      
  `
  return "OK"
}
