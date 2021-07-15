import * as moment from 'moment'

import { plainToClass } from 'class-transformer';

import sql from '../../sql'

import Photo from '../../models/photo'

export default async function main(photoId: bigint, uuid: string) {

  const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  const updatedAt = createdAt

  const photo = (await sql`
                    UPDATE "Photos"
                    SET likes = likes + 1
                    WHERE id = ${photoId}
                    returning *
                    `
                  )[0]

  return plainToClass(Photo, photo)
}
