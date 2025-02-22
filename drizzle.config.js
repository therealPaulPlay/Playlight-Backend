// drizzle.config.js
require('dotenv').config();

module.exports = {
    schema: './JS/schema.js',
    driver: 'mysql2',
    out: './drizzle',
    connectionString: process.env.DB_HOST,
};