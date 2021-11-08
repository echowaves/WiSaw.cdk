import * as moment from 'moment'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Secret from '../../models/secret'

import {_hash,} from './_hash'
export default async function main(uuid: string, nickName: string, secret: string) {
  // const existingNickNameCount = (await sql`SELECT count(*)
  //             FROM "Secrets"
  //             WHERE "nickName" = ${nickName}
  // `)[0].count

  // console.log({existingNickNameCount,})


  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const updatedAt = createdAt

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
                      ${nickName.toLowerCase()}, // always conver to lowercase
                      ${_hash(secret)},
                      ${createdAt},
                      ${updatedAt}
                    )
                    returning *
                    `
  )[0]

  return plainToClass(Secret, newSecret)
}
