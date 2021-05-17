// boilerplate for connecting to DB
const postgres = require('postgres')
const {env} =  process
const sql = postgres({ ...env })

async function listPosts() {
    try {
        const result = null//await db.query(`SELECT * FROM posts`);
        return null // result.records;
    } catch (err) {
        console.log('Postgres error: ', err);
        return null;
    }
}

export default listPosts;
