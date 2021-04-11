import * as sequelize from "sequelize";

// eslint-disable-next-line no-unused-vars
// import pg from 'pg' // this is needed for initialization purpose, although we never user it directly
// eslint-disable-next-line no-unused-vars
// import pgHstore from 'pg-hstore' // the same as above

// eslint-disable-next-line import/prefer-default-export
const db =
  new sequelize.Sequelize(
    (process.env.DB_NAME = 'db_name'),
    (process.env.DB_USER = 'db_user'),
    (process.env.DB_PASSWORD = 'db_password'),
    {
        port: Number(process.env.DB_PORT || 54320),
        host: process.env.DB_HOST || "localhost",
        dialect: "postgres",
        pool: {
            min: 0,
            max: 5,
            acquire: 30000,
            idle: 10000,
        },
        // disable logging; default: console.log
        // logging: log.debug,
        logging: false,
        // operatorsAliases: Sequelize.Op, // use Sequelize.Op
    }
);


db
  .authenticate()
  .then(() => console.log('Connection to database has been established successfully.'))
  .catch(err => console.error('Unable to connect to the database:', err))

export default db
