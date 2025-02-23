require('dotenv').config();

module.exports = {
    schema: './JS/schema.js',
    dialect: 'mysql',
    out: './drizzle',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};