import sql from '../../sql'

import AbuseReport from '../../models/abuseReport'

export default async function main() {

    try {
        return await sql`select * from "AbuseReports"`
    } catch (error) {
        console.log({error})
        return null
    }
}
