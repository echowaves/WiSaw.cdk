// boilerplate for connecting to DB
const postgres = require('postgres')
const {env} =  process
const sql = postgres({ ...env })

import AbuseReport from '../../models/abuseReport'

export default async function main() {

    try {
        return await sql`select * from "AbuseReports"`
    } catch (error) {
        console.log({error})
        return null
    }
}
