const { getDatabase } = require('./database');
const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
require('isomorphic-fetch');

class MicrosoftIntegrations {
    constructor() {
        this.graphClient = null;
        this.msalClient = null;
        this.initialized = false;
        this.initializeMicrosoftServices();
    }

    async initializeMicrosoftServices() {
        try {
            // Initialize MSAL for Entra ID authentication
            if (process.env.MICROSOFT_CLIENT_ID && process.MICROSOFT_TENANT_ID) {
                this.msalClient = new ConfidentialClientApplication({
                    auth: {
                        clientId: process.env.MICROSOFT_CLIENT_ID,
                        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
                        clientSecret: process.env.MICROSOFT_CLIENT_SECRET
                    }
                });
                
                // Get token for Graph API
                const tokenResponse = await this.msalClient.acquireTokenByClientCredential({
                    scopes: ['https://graph.microsoft.com/.default']
                });
                
                // Initialize Graph client
                this.graphClient = Client.init({
                    authProvider: (done) => {
                        done(null, tokenResponse.accessToken);
                    }
                });
                
                this.initialized = true;
                console.log('✅ Microsoft Graph API initialized with real credentials');
            } else {
                console.log('⚠️ Microsoft credentials not found. Running in MOCK mode.');
                this.initialized = false;
            }
        } catch (error) {
            console.error('Microsoft services initialization failed:', error.message);
            this.initialized = false;
        }
    }

    async sendEmail(recipient, subject, content) {
        const emailEnabled = process.env.EMAIL_NOTIFICATION_ENABLED === 'true';
        
        if (!emailEnabled || !this.initialized) {
            console.log(`[MOCK EMAIL] To: ${recipient}, Subject: ${subject}`);
            console.log(`[MOCK EMAIL] Content: ${content.substring(0, 100)}...`);
            return { 
                success: true, 
                mock: true, 
                message: 'Email would be sent in production with Microsoft Graph API',
                details: { recipient, subject }
            };
        }

        try {
            const email = {
                message: {
                    subject: subject,
                    body: {
                        contentType: 'HTML',
                        content: content
                    },
                    toRecipients: [
                        {
                            emailAddress: {
                                address: recipient
                            }
                        }
                    ]
                },
                saveToSentItems: true
            };

            // Microsoft Graph API call
            const result = await this.graphClient
                .api('/users/admin@yourdomain.com/sendMail')
                .post(email);
            
            return { 
                success: true, 
                mock: false, 
                result,
                message: 'Email sent via Microsoft Graph API'
            };
        } catch (error) {
            console.error('Error sending email:', error);
            return { success: false, error: error.message };
        }
    }

    async getOutlookEmails(folder = 'inbox', top = 10) {
        if (!this.initialized) {
            return {
                success: true,
                mock: true,
                emails: [
                    { id: '1', from: 'supplier@wholesalemart.com', subject: 'New shipment available - Order #1234', received: new Date().toISOString(), importance: 'high' },
                    { id: '2', from: 'customer@example.com', subject: 'Order inquiry: Bulk purchase request', received: new Date().toISOString(), importance: 'normal' },
                    { id: '3', from: 'bank@hdfc.com', subject: 'Monthly statement - December 2024', received: new Date().toISOString(), importance: 'low' }
                ]
            };
        }

        try {
            const response = await this.graphClient
                .api(`/me/mailFolders/${folder}/messages`)
                .top(top)
                .select('subject,from,receivedDateTime,importance')
                .orderby('receivedDateTime DESC')
                .get();
            
            return {
                success: true,
                mock: false,
                emails: response.value
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendOutlookReply(emailId, replyContent) {
        if (!this.initialized) {
            return { success: true, mock: true, message: 'Reply would be sent via Outlook' };
        }

        try {
            const reply = {
                comment: replyContent
            };
            await this.graphClient
                .api(`/me/messages/${emailId}/reply`)
                .post(reply);
            return { success: true, mock: false };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async checkProfitThreshold(currentProfit, threshold = null) {
        const profitThreshold = threshold || parseInt(process.env.PROFIT_THRESHOLD) || 5000;
        
        if (currentProfit < profitThreshold) {
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@bizmind.com';
            const subject = `⚠️ Profit Alert: Current Profit Below Threshold (${currentProfit} < ${profitThreshold})`;
            const content = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; }
                        .alert-box { background: #FEE2E2; border-left: 4px solid #EF4444; padding: 16px; margin: 16px 0; }
                        .metric { font-size: 24px; font-weight: bold; color: #EF4444; }
                    </style>
                </head>
                <body>
                    <h2>📊 Profit Threshold Alert - BizMind Enterprise</h2>
                    <div class="alert-box">
                        <p>Your current profit of <span class="metric">₹${currentProfit.toLocaleString()}</span></p>
                        <p>is below the set threshold of <strong>₹${profitThreshold.toLocaleString()}</strong></p>
                    </div>
                    <h3>AI Recommendations:</h3>
                    <ul>
                        <li>Review high-value expenses from last 7 days</li>
                        <li>Check if any payments are pending from customers</li>
                        <li>Consider running a limited-time promotion</li>
                        <li>Review supplier costs for potential negotiation</li>
                    </ul>
                    <hr/>
                    <p><small>Generated by BizMind AI Reasoning Agent | Microsoft Foundry SDK</small></p>
                </body>
                </html>
            `;
            
            // Log to Microsoft Foundry reasoning
            await this.foundryReasoningStep('profit_threshold_check', {
                currentProfit,
                threshold: profitThreshold,
                action: 'alert_sent'
            });
            
            return await this.sendEmail(adminEmail, subject, content);
        }
        return { success: true, message: 'Profit is above threshold', threshold: profitThreshold };
    }

    async checkLowStockAndAlert() {
        const db = getDatabase();
        const lowStockItems = await db.all(`
            SELECT s.*, sup.name as supplier_name, sup.contact as supplier_contact
            FROM stock_items s 
            LEFT JOIN suppliers sup ON s.supplier_id = sup.id
            WHERE s.quantity <= s.reorder_level
            ORDER BY s.quantity ASC
        `);

        if (lowStockItems.length > 0) {
            const adminEmail = process.env.ADMIN_EMAIL || 'admin@bizmind.com';
            
            // Also get supplier emails if available (mock for demo)
            const criticalItems = lowStockItems.filter(i => i.quantity < 5);
            
            let itemsList = '';
            lowStockItems.forEach(item => {
                const status = item.quantity < 5 ? '🔴 CRITICAL' : '🟡 LOW';
                itemsList += `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="padding: 8px;">${item.name}</td>
                        <td style="padding: 8px;">${item.quantity}</td>
                        <td style="padding: 8px;">${item.reorder_level}</td>
                        <td style="padding: 8px;">${item.supplier_name || 'N/A'}</td>
                        <td style="padding: 8px;">${status}</td>
                    </tr>
                `;
            });

            const subject = `📦 Stock Alert: ${lowStockItems.length} items need immediate attention`;
            const content = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; }
                        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
                        th { background: #0078D4; color: white; padding: 12px; text-align: left; }
                        .critical { background: #FEE2E2; }
                    </style>
                </head>
                <body>
                    <h2>🏭 Low Stock Alert - Warehouse Management System</h2>
                    <p><strong>Alert Time:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Items Below Reorder Level:</strong> ${lowStockItems.length}</p>
                    <p><strong>Critical Items (Stock < 5):</strong> ${criticalItems.length}</p>
                    
                    <table>
                        <thead>
                            <tr><th>Item Name</th><th>Current Stock</th><th>Reorder Level</th><th>Supplier</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            ${itemsList}
                        </tbody>
                    </table>
                    
                    <h3>🚨 Immediate Actions Required:</h3>
                    <ul>
                        ${criticalItems.map(item => `<li><strong>${item.name}</strong>: Only ${item.quantity} units left! Order immediately from ${item.supplier_name || 'any supplier'}</li>`).join('')}
                    </ul>
                    
                    <h3>🤖 AI Recommendations:</h3>
                    <ul>
                        <li>Generate purchase orders for critical items first</li>
                        <li>Check if any stock is damaged or misplaced</li>
                        <li>Review sales velocity for frequently out-of-stock items</li>
                        <li>Consider increasing reorder levels for fast-moving products</li>
                    </ul>
                    
                    <hr/>
                    <p><small>Powered by Microsoft Foundry Reasoning Agents | BizMind Enterprise Suite</small></p>
                </body>
                </html>
            `;
            
            await this.foundryReasoningStep('low_stock_check', {
                itemsFound: lowStockItems.length,
                criticalItems: criticalItems.length,
                action: 'alert_sent'
            });
            
            return await this.sendEmail(adminEmail, subject, content);
        }
        return { success: true, message: 'All stock levels are adequate' };
    }

    async sendWeeklyProfitSummary() {
        const db = getDatabase();
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        // Get weekly data
        const weeklyData = await db.all(`
            SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as weekly_income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as weekly_expense
            FROM transactions
            WHERE date >= date(?)
        `, [lastWeek.toISOString().split('T')[0]]);
        
        // Get monthly comparison
        const monthlyData = await db.all(`
            SELECT 
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as monthly_income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as monthly_expense
            FROM transactions
            WHERE date >= date(?)
        `, [lastMonth.toISOString().split('T')[0]]);
        
        const weeklyProfit = (weeklyData[0].weekly_income || 0) - (weeklyData[0].weekly_expense || 0);
        const monthlyProfit = (monthlyData[0].monthly_income || 0) - (monthlyData[0].monthly_expense || 0);
        
        // Get top products (from stock movements)
        const topProducts = await db.all(`
            SELECT s.name, COUNT(sml.id) as movement_count
            FROM stock_items s
            JOIN stock_movement_log sml ON s.id = sml.item_id
            WHERE sml.timestamp >= datetime('now', '-7 days')
            GROUP BY s.id
            ORDER BY movement_count DESC
            LIMIT 5
        `);
        
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@bizmind.com';
        const subject = `📊 Weekly Business Intelligence Report - ${new Date().toLocaleDateString()}`;
        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; }
                    .header { background: linear-gradient(135deg, #0078D4, #00A4EF); color: white; padding: 20px; text-align: center; }
                    .metric-card { background: #F3F4F6; padding: 16px; margin: 16px 0; border-radius: 8px; display: inline-block; width: 30%; margin-right: 2%; }
                    .profit-positive { color: #10B981; font-size: 28px; font-weight: bold; }
                    .profit-negative { color: #EF4444; font-size: 28px; font-weight: bold; }
                    .insight-box { background: #E3F2FD; border-left: 4px solid #0078D4; padding: 16px; margin: 16px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>BizMind Enterprise Suite</h1>
                    <p>Weekly Business Intelligence Report</p>
                </div>
                
                <div style="padding: 20px;">
                    <h2>📈 Performance Summary</h2>
                    <div class="metric-card">
                        <h3>Weekly Income</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #10B981;">₹${(weeklyData[0].weekly_income || 0).toLocaleString()}</p>
                    </div>
                    <div class="metric-card">
                        <h3>Weekly Expenses</h3>
                        <p style="font-size: 24px; font-weight: bold; color: #EF4444;">₹${(weeklyData[0].weekly_expense || 0).toLocaleString()}</p>
                    </div>
                    <div class="metric-card">
                        <h3>Weekly Profit</h3>
                        <p class="${weeklyProfit >= 0 ? 'profit-positive' : 'profit-negative'}">₹${weeklyProfit.toLocaleString()}</p>
                    </div>
                    
                    <div class="insight-box">
                        <h3>🤖 AI Business Insights</h3>
                        <ul>
                            ${weeklyProfit > monthlyProfit * 0.3 ? 
                                '<li>✅ Weekly profit is above 30% of monthly average - Strong performance!</li>' : 
                                '<li>⚠️ Weekly profit is below expectations - Review expense categories</li>'}
                            ${topProducts.length > 0 ? `<li>📦 Top moving products: ${topProducts.map(p => p.name).join(', ')}</li>` : ''}
                            <li>💡 Recommendation: Focus marketing on high-margin products</li>
                            <li>📊 Review supplier contracts for cost optimization</li>
                        </ul>
                    </div>
                    
                    <h3>🎯 Action Items Generated by AI</h3>
                    <ul>
                        <li>${weeklyProfit < 0 ? '🔴 IMMEDIATE: Review all expenses from last week' : '🟢 Schedule: Monthly financial review meeting'}</li>
                        <li>📞 Contact top 3 customers for feedback and upselling</li>
                        <li>📦 Run stock audit for fast-moving items</li>
                    </ul>
                    
                    <hr/>
                    <p><small>Generated by Microsoft Foundry Reasoning Agent | ${new Date().toLocaleString()}</small></p>
                </div>
            </body>
            </html>
        `;
        
        await this.foundryReasoningStep('weekly_summary', {
            weeklyProfit,
            monthlyComparison: monthlyProfit,
            recommendations: 4
        });
        
        return await this.sendEmail(adminEmail, subject, content);
    }

    async getOutlookEmailsWithFilter(folder = 'inbox', filterSubject = null) {
        const result = await this.getOutlookEmails(folder, 20);
        if (result.success && filterSubject) {
            result.emails = result.emails.filter(email => 
                email.subject.toLowerCase().includes(filterSubject.toLowerCase())
            );
        }
        return result;
    }

    async createDraftEmail(recipient, subject, content) {
        if (!this.initialized) {
            return { success: true, mock: true, draftId: 'mock-draft-id' };
        }

        try {
            const draft = {
                message: {
                    subject: subject,
                    body: {
                        contentType: 'HTML',
                        content: content
                    },
                    toRecipients: [{ emailAddress: { address: recipient } }]
                }
            };
            
            const result = await this.graphClient
                .api('/me/messages')
                .post(draft);
            
            return { success: true, draftId: result.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async foundryReasoningStep(step, data) {
        // Microsoft Foundry SDK multi-step reasoning simulation
        const reasoningLog = {
            step: step,
            timestamp: new Date().toISOString(),
            data: data,
            confidence: 0.95,
            traceId: `foundry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        
        // Store in database for traceability
        const db = getDatabase();
        await db.run(`
            INSERT INTO ai_interaction_log (user_query, reasoning_steps, action_taken, status)
            VALUES (?, ?, ?, ?)
        `, [`Foundry_${step}`, JSON.stringify(reasoningLog), step, 'completed']);
        
        console.log(`[Microsoft Foundry] Reasoning: ${step}`, reasoningLog);
        return reasoningLog;
    }

    async getEntraIDUserInfo(accessToken) {
        if (!this.initialized) {
            return {
                success: true,
                mock: true,
                user: {
                    displayName: 'Demo User',
                    email: 'demo@bizmind.com',
                    roles: ['Admin', 'Warehouse Manager']
                }
            };
        }

        try {
            const client = Client.init({
                authProvider: (done) => done(null, accessToken)
            });
            
            const user = await client.api('/me').get();
            return { success: true, user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async workIQDocumentAnalysis(documentBuffer, fileName) {
        // Microsoft Work IQ API - Document Intelligence
        // Mock implementation with real integration points
        
        console.log(`[Work IQ] Analyzing document: ${fileName}`);
        
        // Simulate AI analysis
        const analysis = {
            fileName: fileName,
            pages: 1,
            keyPhrases: [
                'invoice', 'payment due', 'total amount',
                'supplier details', 'order number'
            ],
            entities: {
                amounts: ['₹5,000', '₹12,500'],
                dates: [new Date().toISOString().split('T')[0]],
                vendors: ['Wholesale Mart', 'Anand Traders']
            },
            sentiment: 'positive',
            confidence: 0.92,
            recommendation: 'This document appears to be a supplier invoice. Consider adding to expenses.'
        };
        
        await this.foundryReasoningStep('work_iq_analysis', {
            fileName,
            analysis
        });
        
        return analysis;
    }
}

module.exports = new MicrosoftIntegrations();