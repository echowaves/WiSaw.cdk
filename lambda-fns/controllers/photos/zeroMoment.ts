import * as moment from 'moment'
import sql from '../../sql'
import {plainToClass,} from 'class-transformer'
import Photo from '../../models/photo'

const AWS = require('aws-sdk')

export default async function main() {
  const returned = (await sql`select min("createdAt") from "Photos"`)
  // console.log({returned,})
  return returned[0].min
}
