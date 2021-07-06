import sql from '../../sql'

export default async function main() {
    return await sql`select * from "AbuseReports"`
}
