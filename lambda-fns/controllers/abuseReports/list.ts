import sql from '../../sql'

import AbuseReport from '../../models/abuseReport'

export default async function main() {
    return await sql`select * from "AbuseReports"`
}
