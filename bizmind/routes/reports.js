const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { getDatabase } = require('../database');

function formatCurrency(amount) {
    return `₹${amount.toLocaleString('en-IN')}`;
}

function addCompanyHeader(doc) {
    doc.fontSize(20)
        .font('Helvetica-Bold')
        .text('BizMind Enterprise Suite', { align: 'center' })
        .fontSize(10)
        .font('Helvetica')
        .text('AI-Powered Business Management', { align: 'center' })
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
        .moveDown();
}

// Expense Report
router.get('/expense-report', async (req, res) => {
    try {
        const db = getDatabase();
        const { startDate, endDate } = req.query;
        
        const expenses = await db.all(`
            SELECT * FROM transactions 
            WHERE type = 'expense' 
            AND date BETWEEN ? AND ?
            ORDER BY date DESC
        `, [startDate, endDate]);
        
        const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
        
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=expense-report-${startDate}-to-${endDate}.pdf`);
        doc.pipe(res);
        
        addCompanyHeader(doc);
        doc.fontSize(16).font('Helvetica-Bold').text('Expense Report', { align: 'center' }).moveDown();
        doc.fontSize(12).font('Helvetica')
            .text(`Period: ${startDate} to ${endDate}`)
            .text(`Total Expenses: ${formatCurrency(totalExpense)}`)
            .moveDown();
        
        // Table header
        doc.font('Helvetica-Bold')
            .text('Date', 50, doc.y)
            .text('Description', 150, doc.y)
            .text('Category', 350, doc.y)
            .text('Amount', 450, doc.y);
        
        doc.moveDown();
        
        // Table rows
        doc.font('Helvetica');
        for (const expense of expenses) {
            doc.text(expense.date, 50, doc.y)
                .text(expense.description, 150, doc.y)
                .text(expense.category, 350, doc.y)
                .text(formatCurrency(expense.amount), 450, doc.y);
            doc.moveDown(0.5);
        }
        
        doc.end();
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Profit & Loss Statement
router.get('/profit-loss', async (req, res) => {
    try {
        const db = getDatabase();
        const { startDate, endDate } = req.query;
        
        const income = await db.get(`
            SELECT SUM(amount) as total FROM transactions 
            WHERE type = 'income' AND date BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        const expense = await db.get(`
            SELECT SUM(amount) as total FROM transactions 
            WHERE type = 'expense' AND date BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        const totalIncome = income.total || 0;
        const totalExpense = expense.total || 0;
        const netProfit = totalIncome - totalExpense;
        
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=profit-loss-${startDate}-to-${endDate}.pdf`);
        doc.pipe(res);
        
        addCompanyHeader(doc);
        doc.fontSize(16).font('Helvetica-Bold').text('Profit & Loss Statement', { align: 'center' }).moveDown();
        doc.fontSize(12).font('Helvetica')
            .text(`Period: ${startDate} to ${endDate}`)
            .moveDown();
        
        // Income Section
        doc.font('Helvetica-Bold').fontSize(14).text('INCOME', { underline: true }).moveDown();
        doc.fontSize(12).font('Helvetica')
            .text(`Total Income: ${formatCurrency(totalIncome)}`)
            .moveDown();
        
        // Expense Section
        doc.font('Helvetica-Bold').fontSize(14).text('EXPENSES', { underline: true }).moveDown();
        doc.fontSize(12).font('Helvetica')
            .text(`Total Expenses: ${formatCurrency(totalExpense)}`)
            .moveDown();
        
        // Net Profit
        doc.moveDown();
        doc.font('Helvetica-Bold').fontSize(14)
            .text(`NET PROFIT: ${formatCurrency(netProfit)}`, { align: 'center' })
            .fontSize(10)
            .text(netProfit >= 0 ? '✅ PROFITABLE PERIOD' : '⚠️ LOSS PERIOD - Review expenses', { align: 'center' });
        
        doc.end();
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stock Summary Report
router.get('/stock-summary', async (req, res) => {
    try {
        const db = getDatabase();
        const stock = await db.all(`
            SELECT s.*, sup.name as supplier_name 
            FROM stock_items s 
            LEFT JOIN suppliers sup ON s.supplier_id = sup.id 
            ORDER BY s.category, s.name
        `);
        
        const totalValue = stock.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const lowStockCount = stock.filter(item => item.quantity <= item.reorder_level).length;
        
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=stock-summary-report.pdf');
        doc.pipe(res);
        
        addCompanyHeader(doc);
        doc.fontSize(16).font('Helvetica-Bold').text('Stock Summary Report', { align: 'center' }).moveDown();
        doc.fontSize(12).font('Helvetica')
            .text(`Total Items: ${stock.length}`)
            .text(`Total Inventory Value: ${formatCurrency(totalValue)}`)
            .text(`Low Stock Items: ${lowStockCount}`)
            .moveDown();
        
        // Group by category
        const categories = [...new Set(stock.map(item => item.category))];
        
        for (const category of categories) {
            doc.font('Helvetica-Bold').fontSize(12).text(category.toUpperCase(), { underline: true }).moveDown();
            const categoryItems = stock.filter(item => item.category === category);
            
            doc.font('Helvetica-Bold')
                .text('Item', 50, doc.y)
                .text('Quantity', 250, doc.y)
                .text('Price', 350, doc.y)
                .text('Value', 450, doc.y);
            doc.moveDown();
            
            doc.font('Helvetica');
            for (const item of categoryItems) {
                const value = item.price * item.quantity;
                doc.text(item.name, 50, doc.y)
                    .text(item.quantity.toString(), 250, doc.y)
                    .text(formatCurrency(item.price), 350, doc.y)
                    .text(formatCurrency(value), 450, doc.y);
                doc.moveDown(0.5);
            }
            doc.moveDown();
        }
        
        doc.end();
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Monthly Transaction Slip
router.get('/monthly-slip', async (req, res) => {
    try {
        const db = getDatabase();
        const { month, year } = req.query;
        
        const transactions = await db.all(`
            SELECT * FROM transactions 
            WHERE strftime('%m', date) = ? AND strftime('%Y', date) = ?
            ORDER BY date DESC
        `, [month.padStart(2, '0'), year]);
        
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=monthly-slip-${year}-${month}.pdf`);
        doc.pipe(res);
        
        addCompanyHeader(doc);
        doc.fontSize(16).font('Helvetica-Bold').text(`Monthly Transaction Slip - ${month}/${year}`, { align: 'center' }).moveDown();
        
        doc.font('Helvetica-Bold').fontSize(12).text('Income Transactions:', { underline: true }).moveDown();
        doc.font('Helvetica');
        const incomeTransactions = transactions.filter(t => t.type === 'income');
        for (const t of incomeTransactions) {
            doc.text(`${t.date} - ${t.description}: ${formatCurrency(t.amount)}`);
        }
        doc.text(`Total Income: ${formatCurrency(totalIncome)}`).moveDown();
        
        doc.font('Helvetica-Bold').text('Expense Transactions:', { underline: true }).moveDown();
        doc.font('Helvetica');
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        for (const t of expenseTransactions) {
            doc.text(`${t.date} - ${t.description}: ${formatCurrency(t.amount)}`);
        }
        doc.text(`Total Expenses: ${formatCurrency(totalExpense)}`).moveDown();
        
        doc.font('Helvetica-Bold').text(`Net: ${formatCurrency(totalIncome - totalExpense)}`, { align: 'center' });
        
        doc.end();
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;