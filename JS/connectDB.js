// connectDB.js
const mysql = require('mysql2/promise');
const { drizzle } = require('drizzle-orm/mysql2');

let db;

async function connectDB() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });

        db = drizzle(pool);

        // Test the connection with a simple query
        await db.execute('SELECT 1');
        console.log('Connected to MySQL via Drizzle');
    } catch (err) {
        console.error('Error connecting to MySQL via Drizzle:', err);
        setTimeout(connectDB, 5000);
    }
}

function getDB() {
    if (!db) console.error("Database is not initialized. Did you forget to call connectDB?");
    return db;
}

module.exports = { connectDB, getDB };
