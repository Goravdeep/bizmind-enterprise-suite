const express = require('express');
const router = express.Router();
const multer = require('multer');
const microsoftIntegration = require('../microsoft-integrations');

const upload = multer({ storage: multer.memoryStorage() });

// Analyze document with Microsoft Work IQ
router.post('/analyze-document', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        const analysis = await microsoftIntegration.workIQDocumentAnalysis(
            req.file.buffer,
            req.file.originalname
        );
        
        // Store analysis in database
        const db = require('../database').getDatabase();
        await db.run(`
            INSERT INTO ai_interaction_log (user_query, reasoning_steps, action_taken, status)
            VALUES (?, ?, ?, ?)
        `, [
            `Document analysis: ${req.file.originalname}`,
            JSON.stringify(analysis),
            'work_iq_analysis',
            'completed'
        ]);
        
        res.json({
            success: true,
            analysis: analysis,
            recommendation: analysis.recommendation
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Extract data from invoice (specific Work IQ use case)
router.post('/extract-invoice', upload.single('invoice'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No invoice uploaded' });
        }
        
        const analysis = await microsoftIntegration.workIQDocumentAnalysis(
            req.file.buffer,
            req.file.originalname
        );
        
        // Extract invoice-specific fields
        const invoiceData = {
            invoiceNumber: analysis.entities?.invoiceNumber || `INV-${Date.now()}`,
            date: analysis.entities?.dates?.[0] || new Date().toISOString().split('T')[0],
            totalAmount: analysis.entities?.amounts?.[0] || '0',
            vendor: analysis.entities?.vendors?.[0] || 'Unknown',
            lineItems: analysis.keyPhrases?.filter(p => p.includes('item')) || [],
            confidence: analysis.confidence
        };
        
        res.json({
            success: true,
            invoiceData: invoiceData,
            suggestion: 'Would you like to add this as an expense?'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;