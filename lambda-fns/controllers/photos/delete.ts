import * as moment from 'moment'

import { plainToClass } from 'class-transformer';

import sql from '../../sql'

import Photo from '../../models/photo'

export default async function main(photoId: bigint, uuid: string) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  await sql`
    UPDATE "Photos"
    SET "active" = false
    WHERE id = ${photoId}
    `

  await sql`
    DELETE from "Watchers"
    WHERE "photoId" = ${photoId}
    AND
    "uuid" = ${uuid}
    `
  return "OK"
}