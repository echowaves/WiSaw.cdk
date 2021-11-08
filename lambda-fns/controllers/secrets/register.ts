import * as moment from 'moment'

import {plainToClass,} from 'class-transformer'

import sql from '../../sql'

import Secret from '../../models/secret'

import {_hash,} from './_hash'
export default async function main(uuid: string, nickName: string, secret: string) {
  console.log("this is existingSecret creation ---------------------------------------------------------------")


  const existingSecret = (await sql`SELECT *
              FROM "Secrets"              
              WHERE "nickName" = ${nickName}              
  `)

  console.log({existingSecret,})



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
                      ${nickName},
                      ${_hash(secret)},
                      ${createdAt},
                      ${updatedAt}
                    )
                    returning *
                    `
  )[0]
  console.log({newSecret,})
  return plainToClass(Secret, newSecret)
}
