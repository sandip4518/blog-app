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
    createdAt TEXT NOT NULL,
    userId INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
`;

db.exec(createTable);

// Migration: Add userId column if it doesn't exist (for existing databases)
try {
  const tableInfo = db.prepare("PRAGMA table_info(posts)").all();
  const hasUserId = tableInfo.some(col => col.name === 'userId');
  
  if (!hasUserId) {
    console.log('Adding userId column to posts table...');
    db.exec('ALTER TABLE posts ADD COLUMN userId INTEGER REFERENCES users(id)');
    // Delete posts without a userId (orphaned posts)
    db.exec('DELETE FROM posts WHERE userId IS NULL');
    console.log('Migration complete: userId column added and orphaned posts removed.');
  }
} catch (err) {
  console.error('Migration error:', err);
}


module.exports = db;
