const postgres = require('postgres')
const {env,} = process
const sql = postgres({...env,})

export default sql
