const Pool = require('pg').Pool

// eslint-disable-next-line import/prefer-default-export
// const db =
//   new sequelize.Sequelize(
//     (process.env.DB_NAME = 'db_name'),
//     (process.env.DB_USER = 'db_user'),
//     (process.env.DB_PASSWORD = 'db_password'),
//     {
//         port: Number(process.env.DB_PORT || 54320),
//         host: process.env.DB_HOST || "localhost",
//         dialect: "postgres",
//         pool: {
//             min: 0,
//             max: 5,
//             acquire: 30000,
//             idle: 10000,
//         },
//         // disable logging; default: console.log
//         // logging: log.debug,
//         logging: false,
//         // operatorsAliases: Sequelize.Op, // use Sequelize.Op
//     }
// );


const db = new Pool({
  user: process.env.DB_USER ,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
})

export default db
