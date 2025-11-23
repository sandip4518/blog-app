const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'blog.db');
const db = new Database(dbPath);

// Create posts table if it doesn't exist
const createTable = `
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`;

db.exec(createTable);

module.exports = db;
