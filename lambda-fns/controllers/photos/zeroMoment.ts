import * as moment from 'moment'
import sql from '../../sql'
import {plainToClass,} from 'class-transformer'
import Photo from '../../models/photo'

const AWS = require('aws-sdk')

export default async function main() {
  return (await sql`select min("createdAt") from "Photos"`)[0].min
}
