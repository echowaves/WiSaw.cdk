import psql from "../../psql"

// import Photo from '../../models/photo'

export default async function main(photoId: bigint, uuid: string) {
  // const createdAt = moment().format("YYYY-MM-DD HH:mm:ss.SSS")
  await psql.connect()

  await psql.query(`
      UPDATE "Photos"
    SET "active" = false
    WHERE id = ${photoId}
    `)

  await psql.query(`
    DELETE from "Watchers"
    WHERE "photoId" = ${photoId}
    AND
    "uuid" = '${uuid}'
    `)
  await psql.clean()

  return "OK"
}
