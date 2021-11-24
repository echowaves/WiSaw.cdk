
export const _deleteFriendshipByFrienshipUuid = async( friendshipUuid: string, sql: any) => {
  await sql`
    DELETE from "Friendships"
    WHERE "friendshipUuid" = ${friendshipUuid}
  `
  return "OK"
}
