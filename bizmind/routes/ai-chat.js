const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database');
const microsoftIntegration = require('../microsoft-integrations');

// Language detection and response mapping
function detectLanguage(text) {
    const hindiPattern = /[अ-ह]/;
    if (hindiPattern.test(text)) return 'hindi';
    
    const hinglishPattern = /(hai|kya|kar|de|le|na|ki|se|ko|mein|hain|tha|the|thi|nahi|aap|tum|main|mujhe|tere|mera|tera)/i;
    if (hinglishPattern.test(text)) return 'hinglish';
    
    return 'english';
}

function translateResponse(response, language) {
    const translations = {
        'english': response,
        'hinglish': response
            .replace(/Successfully added/g, 'Add ho gaya')
            .replace(/Successfully updated/g, 'Update ho gaya')
            .replace(/Successfully deleted/g, 'Delete ho gaya')
            .replace(/Confirm/g, 'Confirm karo')
            .replace(/Please confirm/g, 'Kripya confirm karein')
            .replace(/Operation cancelled/g, 'Operation cancel kiya gaya'),
        'hindi': response
            .replace(/Successfully added/g, 'सफलतापूर्वक जोड़ा गया')
            .replace(/Successfully updated/g, 'सफलतापूर्वक अपडेट किया गया')
            .replace(/Successfully deleted/g, 'सफलतापूर्वक हटाया गया')
            .replace(/Confirm/g, 'पुष्टि करें')
            .replace(/Please confirm/g, 'कृपया पुष्टि करें')
            .replace(/Operation cancelled/g, 'ऑपरेशन रद्द किया गया')
    };
    return translations[language] || response;
}

async function processCommand(command, language, sessionId) {
    const reasoningSteps = [];
    const db = getDatabase();
    
    // Step 1: Parse command
    reasoningSteps.push({ step: 1, action: 'Parsing natural language command', status: 'completed' });
    await microsoftIntegration.foundryReasoningStep('parse', { command, language });
    
    const lowerCommand = command.toLowerCase();
    let intent = null;
    let params = {};
    
    // Step 2: Detect intent
    reasoningSteps.push({ step: 2, action: 'Detecting user intent', status: 'in_progress' });
    
    if (lowerCommand.includes('add expense') || lowerCommand.includes('expense add')) {
        intent = 'add_expense';
        const match = command.match(/(\d+)\s*(?:rs|rupees|₹)?\s*(?:for|of)?\s*(.+)/i);
        if (match) {
            params.amount = parseFloat(match[1]);
            params.description = match[2];
        }
    } 
    else if (lowerCommand.includes('add supplier') || lowerCommand.includes('supplier add')) {
        intent = 'add_supplier';
        const match = command.match(/supplier\s+(?:named\s+)?(.+)/i);
        if (match) params.name = match[1];
    }
    else if (lowerCommand.includes('reduce stock') || lowerCommand.includes('stock reduce')) {
        intent = 'reduce_stock';
        const match = command.match(/(?:stock\s+of\s+)?(.+?)\s+by\s+(\d+)/i);
        if (match) {
            params.itemName = match[1];
            params.quantity = parseInt(match[2]);
        }
    }
    else if (lowerCommand.includes('increase stock') || lowerCommand.includes('stock increase')) {
        intent = 'increase_stock';
        const match = command.match(/(?:stock\s+of\s+)?(.+?)\s+by\s+(\d+)/i);
        if (match) {
            params.itemName = match[1];
            params.quantity = parseInt(match[2]);
        }
    }
    else if (lowerCommand.includes('last month profit') || lowerCommand.includes('profit last month')) {
        intent = 'get_profit';
    }
    else if (lowerCommand.includes('send email') && lowerCommand.includes('low stock')) {
        intent = 'send_low_stock_email';
    }
    else if (lowerCommand.includes('show low stock') || lowerCommand.includes('low stock items')) {
        intent = 'show_low_stock';
    }
    else if (lowerCommand.includes('delete stock') || lowerCommand.includes('remove stock')) {
        intent = 'delete_stock';
        const match = command.match(/(?:stock\s+)?(.+)/i);
        if (match) params.itemName = match[1];
    }
    
    reasoningSteps[1].status = 'completed';
    
    // Step 3: Check permissions
    reasoningSteps.push({ step: 3, action: 'Checking user permissions', status: 'completed' });
    
    // Step 4: Execute based on intent
    reasoningSteps.push({ step: 4, action: 'Executing command', status: 'in_progress' });
    let result = null;
    
    try {
        switch(intent) {
            case 'add_expense':
                if (params.amount && params.description) {
                    await db.run(
                        'INSERT INTO transactions (type, amount, description, category, date) VALUES (?, ?, ?, ?, ?)',
                        ['expense', params.amount, params.description, 'ai-added', new Date().toISOString().split('T')[0]]
                    );
                    result = { success: true, message: `Added expense of ₹${params.amount} for ${params.description}` };
                }
                break;
                
            case 'add_supplier':
                if (params.name) {
                    await db.run(
                        'INSERT INTO suppliers (name, address, contact, gst) VALUES (?, ?, ?, ?)',
                        [params.name, 'Address pending', 'Contact pending', 'GST pending']
                    );
                    result = { success: true, message: `Added new supplier: ${params.name}` };
                }
                break;
                
            case 'reduce_stock':
                if (params.itemName && params.quantity) {
                    const item = await db.get('SELECT * FROM stock_items WHERE name LIKE ?', [`%${params.itemName}%`]);
                    if (item) {
                        const newQuantity = Math.max(0, item.quantity - params.quantity);
                        await db.run('UPDATE stock_items SET quantity = ? WHERE id = ?', [newQuantity, item.id]);
                        await db.run(
                            'INSERT INTO stock_movement_log (item_id, movement_type, quantity, reason) VALUES (?, ?, ?, ?)',
                            [item.id, 'out', params.quantity, 'AI command']
                        );
                        result = { success: true, message: `Reduced ${params.itemName} stock by ${params.quantity} units. New quantity: ${newQuantity}` };
                    } else {
                        result = { success: false, message: `Item '${params.itemName}' not found` };
                    }
                }
                break;
                
            case 'increase_stock':
                if (params.itemName && params.quantity) {
                    const item = await db.get('SELECT * FROM stock_items WHERE name LIKE ?', [`%${params.itemName}%`]);
                    if (item) {
                        const newQuantity = item.quantity + params.quantity;
                        await db.run('UPDATE stock_items SET quantity = ? WHERE id = ?', [newQuantity, item.id]);
                        await db.run(
                            'INSERT INTO stock_movement_log (item_id, movement_type, quantity, reason) VALUES (?, ?, ?, ?)',
                            [item.id, 'in', params.quantity, 'AI command']
                        );
                        result = { success: true, message: `Increased ${params.itemName} stock by ${params.quantity} units. New quantity: ${newQuantity}` };
                    } else {
                        result = { success: false, message: `Item '${params.itemName}' not found` };
                    }
                }
                break;
                
            case 'get_profit':
                const lastMonth = new Date();
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                const income = await db.get('SELECT SUM(amount) as total FROM transactions WHERE type = ? AND date >= date(?)', ['income', lastMonth]);
                const expense = await db.get('SELECT SUM(amount) as total FROM transactions WHERE type = ? AND date >= date(?)', ['expense', lastMonth]);
                const profit = (income.total || 0) - (expense.total || 0);
                result = { success: true, message: `Last month's profit was ₹${profit.toLocaleString()}` };
                break;
                
            case 'send_low_stock_email':
                await microsoftIntegration.checkLowStockAndAlert();
                result = { success: true, message: 'Low stock email alert sent successfully' };
                break;
                
            case 'show_low_stock':
                const lowStock = await db.all('SELECT * FROM stock_items WHERE quantity <= reorder_level');
                if (lowStock.length > 0) {
                    let items = lowStock.map(i => `${i.name}: ${i.quantity}/${i.reorder_level}`).join(', ');
                    result = { success: true, message: `Low stock items: ${items}` };
                } else {
                    result = { success: true, message: 'No items are currently below reorder level' };
                }
                break;
                
            case 'delete_stock':
                if (params.itemName) {
                    const item = await db.get('SELECT * FROM stock_items WHERE name LIKE ?', [`%${params.itemName}%`]);
                    if (item) {
                        await db.run('DELETE FROM stock_items WHERE id = ?', [item.id]);
                        result = { success: true, message: `Deleted stock item: ${item.name}` };
                    } else {
                        result = { success: false, message: `Item '${params.itemName}' not found` };
                    }
                }
                break;
                
            default:
                result = { success: false, message: 'Command not recognized. Try: Add expense, Add supplier, Reduce stock, Show low stock, etc.' };
        }
        
        // Log AI interaction
        await db.run(
            'INSERT INTO ai_interaction_log (user_query, reasoning_steps, action_taken, status) VALUES (?, ?, ?, ?)',
            [command, JSON.stringify(reasoningSteps), intent || 'unknown', result.success ? 'success' : 'failed']
        );
        
    } catch (error) {
        result = { success: false, message: `Error: ${error.message}` };
    }
    
    reasoningSteps[3].status = 'completed';
    reasoningSteps.push({ step: 5, action: 'Preparing response', status: 'completed' });
    
    return { result, reasoningSteps };
}

router.post('/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        const language = detectLanguage(message);
        
        // First, check if confirmation is needed for write operations
        const writeIntents = ['add_expense', 'add_supplier', 'reduce_stock', 'increase_stock', 'delete_stock'];
        const needsConfirmation = writeIntents.some(intent => message.toLowerCase().includes(intent.replace('_', ' ')));
        
        if (needsConfirmation && !req.body.confirmed) {
            const confirmMessage = translateResponse('Please confirm this operation. Type "confirm" to proceed or "cancel" to abort.', language);
            return res.json({
                success: true,
                needsConfirmation: true,
                message: confirmMessage,
                language: language
            });
        }
        
        const { result, reasoningSteps } = await processCommand(message, language, sessionId);
        const responseMessage = translateResponse(result.message, language);
        
        res.json({
            success: result.success,
            message: responseMessage,
            reasoningSteps: reasoningSteps,
            language: language,
            needsConfirmation: false
        });
        
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/history', async (req, res) => {
    try {
        const db = getDatabase();
        const history = await db.all('SELECT * FROM ai_interaction_log ORDER BY timestamp DESC LIMIT 50');
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;