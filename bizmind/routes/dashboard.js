const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const microsoftIntegration = require('../microsoft-integrations');

// Get dashboard data
router.get('/data', async (req, res) => {
    try {
        const db = getDatabase();
        
        // Get total income
        const incomeResult = await db.get(`
            SELECT SUM(amount) as total FROM transactions 
            WHERE type = 'income' AND date >= date('now', '-30 days')
        `);
        
        // Get total expense
        const expenseResult = await db.get(`
            SELECT SUM(amount) as total FROM transactions 
            WHERE type = 'expense' AND date >= date('now', '-30 days')
        `);
        
        // Get low stock items
        const lowStockItems = await db.all(`
            SELECT * FROM stock_items 
            WHERE quantity <= reorder_level
            ORDER BY quantity ASC
        `);
        
        // Get recent transactions
        const recentTransactions = await db.all(`
            SELECT * FROM transactions 
            ORDER BY date DESC, id DESC 
            LIMIT 10
        `);
        
        // Get weekly profit trend
        const weeklyProfit = await db.all(`
            SELECT 
                strftime('%W', date) as week,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense
            FROM transactions
            WHERE date >= date('now', '-30 days')
            GROUP BY week
            ORDER BY week DESC
            LIMIT 4
        `);
        
        const totalIncome = incomeResult.total || 0;
        const totalExpense = expenseResult.total || 0;
        const totalProfit = totalIncome - totalExpense;
        
        // Check profit threshold
        await microsoftIntegration.checkProfitThreshold(totalProfit);
        
        res.json({
            success: true,
            data: {
                totalIncome,
                totalExpense,
                totalProfit,
                lowStockItems,
                recentTransactions,
                weeklyProfit: weeklyProfit.reverse()
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Trigger low stock email
router.post('/check-low-stock', async (req, res) => {
    try {
        const result = await microsoftIntegration.checkLowStockAndAlert();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send test email
router.post('/test-email', async (req, res) => {
    try {
        const result = await microsoftIntegration.sendEmail(
            'test@bizmind.com',
            'BizMind Test Email',
            '<h1>Test Successful!</h1><p>Your Microsoft Graph integration is working.</p>'
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send weekly summary email
router.post('/send-weekly-summary', async (req, res) => {
    try {
        const result = await microsoftIntegration.sendWeeklyProfitSummary();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send custom email via Graph API
router.post('/send-email', async (req, res) => {
    try {
        const { email, subject, content } = req.body;
        const result = await microsoftIntegration.sendEmail(email, subject, content);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get Outlook emails
router.get('/outlook-emails', async (req, res) => {
    try {
        const result = await microsoftIntegration.getOutlookEmails();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;