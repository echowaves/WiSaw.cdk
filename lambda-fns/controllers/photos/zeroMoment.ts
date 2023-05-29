import psql from "../../psql"
// import {plainToClass,} from 'class-transformer'
// import Photo from '../../models/photo'

export default async function main() {
  await psql.connect()

  const min = (
    await psql.query(`
    select min("createdAt") from "Photos"`)
  ).rows[0].min
  // console.log({returned,})
  await psql.clean()
  return min
}
