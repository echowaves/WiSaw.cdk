import * as moment from 'moment'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Secret from '../../models/secret'

import {_hash,} from './_hash'

/*

use cases:

uuid       nickName       secret            outcome
              0                               no records with this nickName found -- create new secret record
                                              the new record with existing uuid should fail to create, then the new uuid needs to be regened and new request sent
              x             0                 nickName found, but secret does not match -- throw exception (try different combination of nickName/secret)
              x             x                 nickName and secret match -- account already exists, return uuid

*/

export default async function main(uuid: string, nickName: string, secret: string) {
  const existingSecret = (await sql`SELECT *
              FROM "Secrets"
              WHERE "nickName" = ${nickName}
  `)

  // no records with this nickName found -- create new secret record
  if(existingSecret.count === 0) {
    console.log('case 1 ----------------------------------------------------')
    const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
    const updatedAt = createdAt

    // here validate values before inserting into DB

    const newSecret = (await sql`
                    INSERT INTO "Secrets"
                    (
                        "uuid",
                        "nickName",
                        "secret",
                        "createdAt",
                        "updatedAt"
                    ) values (
                      ${uuid},
                      ${nickName.toLowerCase()},   
                      ${_hash(secret)},
                      ${createdAt},
                      ${updatedAt}
                    )
                    returning *
                    `
    )
    return plainToClass(Secret, newSecret[0])
  }

  // nickName found, but secret does not match -- throw exception (try different combination of nickName/password)
  if(existingSecret[0].secret !== _hash(secret)) {
    console.log('case 2 ----------------------------------------------------')
    console.log(`${existingSecret[0].secret} !== ${_hash(secret)}`)
    throw new Error('try different combination of nickName/secret')
  }

  console.log('case 3 ----------------------------------------------------')
  console.log(`${existingSecret[0].secret} === ${_hash(secret)}`)

  return plainToClass(Secret, existingSecret[0])
}
