import sql from '../../sql'
import {validate as uuidValidate,} from 'uuid'

import {plainToClass,} from 'class-transformer'
import Friendship from '../../models/friendship'


export default async function main(
  uuid: string
) {
  if(uuidValidate(uuid) === false) {
    throw new Error(`Wrong UUID format`)
  }

  const friendships = (await sql`SELECT *
      FROM "Friends"
      WHERE "friendshipUuid" = ${uuid}
    `)

  // if(friends.length !== 2) {
  //   throw new Error(`Friendship is not established`)
  // }

  // const filteredFriends = friends.filter((friend: any) => friend.uuid !== uuid)
  // if(filteredFriends.length >= 2) {
  //   throw new Error(`Too many friends in this Friendship`)
  // }

  return friendships.map((friendship: Friendship) => plainToClass(Friendship, friendship))

}
