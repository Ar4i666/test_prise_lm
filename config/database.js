require('dotenv').config();
const knex = require('knex');

// Подключение к удаленной базе данных (через SSH-туннель)
const remoteDb = knex({
  client: 'mysql2',
  connection: {
    host: process.env.REMOTE_DB_HOST || '127.0.0.1',
    port: process.env.REMOTE_DB_PORT || 3306,
    user: process.env.REMOTE_DB_USER || 'readonly_user',
    password: process.env.REMOTE_DB_PASSWORD || 'password',
    database: process.env.REMOTE_DB_NAME || 'liftmedia'
  }
});

// Подключение к локальной базе данных (SQLite)
const localDb = knex({
  client: 'sqlite3',
  connection: {
    filename: process.env.LOCAL_DB_FILE || './database.sqlite'
  },
  useNullAsDefault: true // Необходимо для SQLite в Knex
});

module.exports = {
  remoteDb,
  localDb
};
