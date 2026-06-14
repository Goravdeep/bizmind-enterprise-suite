const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

// Get all suppliers
router.get('/suppliers', async (req, res) => {
    try {
        const db = getDatabase();
        const suppliers = await db.all('SELECT * FROM suppliers ORDER BY name');
        res.json({ success: true, data: suppliers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add supplier
router.post('/suppliers', async (req, res) => {
    try {
        const { name, address, contact, gst } = req.body;
        const db = getDatabase();
        const result = await db.run(
            'INSERT INTO suppliers (name, address, contact, gst) VALUES (?, ?, ?, ?)',
            [name, address, contact, gst]
        );
        res.json({ success: true, id: result.lastID });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update supplier
router.put('/suppliers/:id', async (req, res) => {
    try {
        const { name, address, contact, gst } = req.body;
        const db = getDatabase();
        await db.run(
            'UPDATE suppliers SET name = ?, address = ?, contact = ?, gst = ? WHERE id = ?',
            [name, address, contact, gst, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete supplier
router.delete('/suppliers/:id', async (req, res) => {
    try {
        const db = getDatabase();
        await db.run('DELETE FROM suppliers WHERE id = ?', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all stock items
router.get('/stock', async (req, res) => {
    try {
        const db = getDatabase();
        const { category } = req.query;
        let query = 'SELECT s.*, sup.name as supplier_name FROM stock_items s LEFT JOIN suppliers sup ON s.supplier_id = sup.id';
        let params = [];
        
        if (category && category !== 'all') {
            query += ' WHERE s.category = ?';
            params.push(category);
        }
        
        query += ' ORDER BY s.name';
        const stock = await db.all(query, params);
        res.json({ success: true, data: stock });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add stock item
router.post('/stock', async (req, res) => {
    try {
        const { name, category, quantity, reorder_level, price, supplier_id } = req.body;
        const db = getDatabase();
        const result = await db.run(
            'INSERT INTO stock_items (name, category, quantity, reorder_level, price, supplier_id) VALUES (?, ?, ?, ?, ?, ?)',
            [name, category, parseInt(quantity), parseInt(reorder_level), parseFloat(price), supplier_id || null]
        );
        res.json({ success: true, id: result.lastID });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update stock item
router.put('/stock/:id', async (req, res) => {
    try {
        const { name, category, quantity, reorder_level, price, supplier_id } = req.body;
        const db = getDatabase();
        
        // Get old quantity to log movement
        const oldItem = await db.get('SELECT quantity FROM stock_items WHERE id = ?', req.params.id);
        
        await db.run(
            'UPDATE stock_items SET name = ?, category = ?, quantity = ?, reorder_level = ?, price = ?, supplier_id = ? WHERE id = ?',
            [name, category, parseInt(quantity), parseInt(reorder_level), parseFloat(price), supplier_id || null, req.params.id]
        );
        
        // Log quantity change if significant
        if (oldItem && Math.abs(oldItem.quantity - parseInt(quantity)) > 0) {
            const movementType = parseInt(quantity) > oldItem.quantity ? 'in' : 'out';
            const changeAmount = Math.abs(oldItem.quantity - parseInt(quantity));
            await db.run(
                'INSERT INTO stock_movement_log (item_id, movement_type, quantity, reason) VALUES (?, ?, ?, ?)',
                [req.params.id, movementType, changeAmount, 'Manual update']
            );
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete stock item
router.delete('/stock/:id', async (req, res) => {
    try {
        const db = getDatabase();
        await db.run('DELETE FROM stock_items WHERE id = ?', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bulk update stock
router.post('/stock/bulk-update', async (req, res) => {
    try {
        const { updates } = req.body;
        const db = getDatabase();
        
        for (const update of updates) {
            await db.run(
                'UPDATE stock_items SET quantity = ? WHERE id = ?',
                [update.quantity, update.id]
            );
        }
        
        res.json({ success: true, message: `${updates.length} items updated` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get stock movement log
router.get('/movement-log', async (req, res) => {
    try {
        const db = getDatabase();
        const logs = await db.all(`
            SELECT sml.*, s.name as item_name 
            FROM stock_movement_log sml 
            JOIN stock_items s ON sml.item_id = s.id 
            ORDER BY sml.timestamp DESC 
            LIMIT 50
        `);
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;