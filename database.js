const mysql = require('mysql2/promise');

let connection;

async function connectToDatabase() {
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });
        console.log('Connected to MySQL database');
    } catch (err) {
        console.error('Error connecting to MySQL database:', err);
    }
}

module.exports = { connectToDatabase, connection };
