// schema.js
const { mysqlTable, serial, varchar, timestamp, int } = require('drizzle-orm/mysql-core');

const users = mysqlTable('users', {
    id: serial('id').primaryKey(),
    user_name: varchar('user_name', { length: 50 }),
    email: varchar('email', { length: 100 }),
    password: varchar('password', { length: 255 }),
    created_at: timestamp('created_at'),
});

module.exports = { users };