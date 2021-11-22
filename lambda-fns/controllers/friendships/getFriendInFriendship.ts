import sql from '../../sql'
import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'
import Friend from '../../models/friend'


export default async function main(
  friendshipUuid: string,
  uuid: string
) {

  if(
    uuidValidate(uuid) === false
  || uuidValidate(friendshipUuid) === false ) {
    throw new Error(`Wrong UUID format`)
  }


  const friends = (await sql`SELECT *
      FROM "Friends"
      WHERE "friendshipUuid" = ${friendshipUuid}
    `)

  if(friends.length !== 2) {
    throw new Error(`Friendship is not established`)
  }

  const filteredFriends = friends.filter((friend: any) => friend.uuid !== uuid)
  if(filteredFriends.length >= 2) {
    throw new Error(`Too many friends in this Friendship`)
  }

  return plainToClass(Friend, filteredFriends[0])
}
