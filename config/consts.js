// import Sequelize from 'sequelize'
// // eslint-disable-next-line no-unused-vars
// import pg from 'pg' // this is needed for initialization purpose, although we never user it directly
// // eslint-disable-next-line no-unused-vars
// import pgHstore from 'pg-hstore' // the same as above
//
// import log from 'lambda-log'
//
// import * as dbConfig from './config'
//
// log.options.debug = true;
//
// if ((process.env.STAGE || 'test') === 'test') {
//   process.env.DATABASE_URL = dbConfig.test.DATABASE_URL
// }
//
// // eslint-disable-next-line import/prefer-default-export
// export const sequelize =
// new Sequelize(process.env.DATABASE_URL, {
//   // disable logging; default: console.log
//   // logging: log.debug,
//   logging: false,
//   // operatorsAliases: Sequelize.Op, // use Sequelize.Op
// })
//
// sequelize
//   .authenticate()
//   .then(() => console.log('Connection to database has been established successfully.'))
//   .catch(err => console.error('Unable to connect to the database:', err))
//
// // export default sequelize
