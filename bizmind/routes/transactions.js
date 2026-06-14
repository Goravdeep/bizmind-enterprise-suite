const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');

// Get all transactions with filters
router.get('/', async (req, res) => {
    try {
        const db = getDatabase();
        const { startDate, endDate, type } = req.query;
        
        let query = 'SELECT * FROM transactions WHERE 1=1';
        let params = [];
        
        if (startDate) {
            query += ' AND date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND date <= ?';
            params.push(endDate);
        }
        
        if (type && type !== 'all') {
            query += ' AND type = ?';
            params.push(type);
        }
        
        query += ' ORDER BY date DESC, id DESC';
        
        const transactions = await db.all(query, params);
        res.json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add transaction
router.post('/', async (req, res) => {
    try {
        const { type, amount, description, category, date, receipt_note } = req.body;
        const db = getDatabase();
        const result = await db.run(
            'INSERT INTO transactions (type, amount, description, category, date, receipt_note) VALUES (?, ?, ?, ?, ?, ?)',
            [type, parseFloat(amount), description, category, date, receipt_note || null]
        );
        res.json({ success: true, id: result.lastID });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update transaction
router.put('/:id', async (req, res) => {
    try {
        const { type, amount, description, category, date, receipt_note } = req.body;
        const db = getDatabase();
        await db.run(
            'UPDATE transactions SET type = ?, amount = ?, description = ?, category = ?, date = ?, receipt_note = ? WHERE id = ?',
            [type, parseFloat(amount), description, category, date, receipt_note || null, req.params.id]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
    try {
        const db = getDatabase();
        await db.run('DELETE FROM transactions WHERE id = ?', req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Export to CSV
router.get('/export/csv', async (req, res) => {
    try {
        const db = getDatabase();
        const transactions = await db.all('SELECT * FROM transactions ORDER BY date DESC');
        
        let csv = 'ID,Type,Amount,Description,Category,Date,Receipt Note\n';
        for (const t of transactions) {
            csv += `${t.id},${t.type},${t.amount},${t.description},${t.category},${t.date},${t.receipt_note || ''}\n`;
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;