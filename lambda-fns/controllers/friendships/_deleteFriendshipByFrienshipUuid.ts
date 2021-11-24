import sql from '../../sql'

export const _deleteFriendshipByFrienshipUuid = async( friendshipUuid: string) => {
  await sql`
    DELETE from "Friendships"
    WHERE "freindshipUuid" = ${friendshipUuid}"      
  `
  return "OK"
}
