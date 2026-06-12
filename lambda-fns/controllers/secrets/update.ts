import dayjs, { type Dayjs } from 'dayjs'

import { plainToClass } from "class-transformer"

import psql from "../../psql"
import { assertValidUuid } from '../../utilities/assertValidUuid'

import Secret from "../../models/secret"

import { _hash } from "./_hash"

/*

use cases:

uuid       nickName       secret            outcome
              0                               no records with this nickName found -- create new secret record
                                              the new record with existing uuid should fail to create, then the new uuid needs to be regened and new request sent
              x             0                 nickName found, but secret does not match -- throw exception (try different combination of nickName/secret)
              x             x                 nickName and secret match -- account already exists, return uuid

*/

export default async function main(
  uuid: string,
  nickName: string,
  secret: string,
  newSecret: string,
) {
  assertValidUuid(uuid, 'uuid')

  const updatedAt = dayjs().toISOString()
  const secretValid = newSecret.length >= 5 && newSecret.length <= 512

  if (!secretValid) {
    throw new Error(`Invalid new Secret`)
  }
  await psql.connect()

  const updatedSecret = (
    await psql.query(`
    UPDATE "Secrets"
                  SET
                    "secret" = $1,
                    "updatedAt" =  $2                
                  WHERE
                    "uuid" = $3
                    AND
                    "nickName" = $4
                    AND
                    "secret" = $5
                  returning *
                  `, [_hash(newSecret), updatedAt, uuid, nickName.toLowerCase(), _hash(secret)])
  ).rows
  if (updatedSecret.length !== 1) {
    throw new Error(`Failed to update secret`)
  }

  return plainToClass(Secret, updatedSecret[0])
}
