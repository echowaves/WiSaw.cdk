import moment from "moment"

import { plainToClass } from "class-transformer"

import psql from "../../psql"

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
  const updatedAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const secretValid = newSecret.length >= 5 && newSecret.length <= 512

  if (!secretValid) {
    throw new Error(`Invalid new Secret`)
  }
  await psql.connect()

  const updatedSecret = (
    await psql.query(`
    UPDATE "Secrets"
                  SET
                    "secret" = '${_hash(newSecret)}',
                    "updatedAt" =  '${updatedAt}'                
                  WHERE
                    "uuid" = '${uuid}'
                    AND
                    "nickName" = '${nickName.toLowerCase()}'
                    AND
                    "secret" = '${_hash(secret)}'
                  returning *
                  `)
  ).rows
  if (updatedSecret.length !== 1) {
    throw new Error(`Failed to update secret`)
  }

  return plainToClass(Secret, updatedSecret[0])
}
