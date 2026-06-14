const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let dbInstance = null;

async function initializeDatabase() {
    const db = await open({
        filename: path.join(__dirname, 'bizmind.db'),
        driver: sqlite3.Database
    });

    // Create tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            contact TEXT,
            gst TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS stock_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT CHECK(category IN ('raw material', 'packaging', 'finished goods')),
            quantity INTEGER DEFAULT 0,
            reorder_level INTEGER DEFAULT 10,
            price DECIMAL(10,2),
            supplier_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT CHECK(type IN ('income', 'expense')),
            amount DECIMAL(10,2) NOT NULL,
            description TEXT,
            category TEXT,
            date DATE NOT NULL,
            receipt_note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS stock_movement_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            movement_type TEXT CHECK(movement_type IN ('in', 'out')),
            quantity INTEGER,
            reason TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES stock_items(id)
        );

        CREATE TABLE IF NOT EXISTS ai_interaction_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_query TEXT,
            reasoning_steps TEXT,
            action_taken TEXT,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
        CREATE INDEX IF NOT EXISTS idx_stock_items_category ON stock_items(category);
    `);

    dbInstance = db;
    return db;
}

function getDatabase() {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
    return dbInstance;
}

module.exports = { initializeDatabase, getDatabase };