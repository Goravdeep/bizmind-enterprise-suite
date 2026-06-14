require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./database');
const seedDatabase = require('./seed-data');
const microsoftAuthRoutes = require('./routes/microsoft-auth');
const workIQRoutes = require('./routes/work-iq');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'bizmind_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Import routes
const dashboardRoutes = require('./routes/dashboard');
const warehouseRoutes = require('./routes/warehouse');
const transactionRoutes = require('./routes/transactions');
const reportRoutes = require('./routes/reports');
const aiChatRoutes = require('./routes/ai-chat');

// Use routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiChatRoutes);
app.use('/auth', microsoftAuthRoutes);
app.use('/api/work-iq', workIQRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/warehouse', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'warehouse.html'));
});

app.get('/transactions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'transactions.html'));
});

app.get('/microsoft-demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'microsoft-demo.html'));
});

// Initialize database and start server
async function startServer() {
    try {
        await initializeDatabase();
        await seedDatabase();
        
        app.listen(PORT, () => {
            console.log(`🚀 BizMind Enterprise Suite running on http://localhost:${PORT}`);
            console.log(`📊 Dashboard: http://localhost:${PORT}`);
            console.log(`🏭 Warehouse: http://localhost:${PORT}/warehouse`);
            console.log(`💰 Transactions: http://localhost:${PORT}/transactions`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

startServer();