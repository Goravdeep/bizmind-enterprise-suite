const { initializeDatabase, getDatabase } = require('./database');

async function seedDatabase() {
    await initializeDatabase();
    const db = getDatabase();

    // Check if data already exists
    const supplierCount = await db.get('SELECT COUNT(*) as count FROM suppliers');
    if (supplierCount.count > 0) {
        console.log('Database already has data. Skipping seed.');
        return;
    }

    console.log('Seeding database with demo data...');

    // Insert Suppliers
    const suppliers = [
        { name: 'Wholesale Mart', address: '123 Market Street, Mumbai', contact: '+91-9876543210', gst: '27AAAAA1234B1Z' },
        { name: 'Anand Traders', address: '456 Business Park, Delhi', contact: '+91-9876543211', gst: '07BBBBB5678C2Z' },
        { name: 'City Distributors', address: '789 Commercial Complex, Bangalore', contact: '+91-9876543212', gst: '29CCCCC9012D3Z' }
    ];

    for (const supplier of suppliers) {
        await db.run(
            'INSERT INTO suppliers (name, address, contact, gst) VALUES (?, ?, ?, ?)',
            [supplier.name, supplier.address, supplier.contact, supplier.gst]
        );
    }

    // Insert Stock Items
    const stockItems = [
        { name: 'Basmati Rice', category: 'raw material', quantity: 45, reorder_level: 20, price: 85, supplier_id: 1 },
        { name: 'Cooking Oil', category: 'raw material', quantity: 12, reorder_level: 15, price: 120, supplier_id: 1 },
        { name: 'Sugar', category: 'packaging', quantity: 8, reorder_level: 10, price: 40, supplier_id: 2 },
        { name: 'Premium Tea', category: 'finished goods', quantity: 65, reorder_level: 25, price: 250, supplier_id: 2 },
        { name: 'Butter Biscuits', category: 'finished goods', quantity: 3, reorder_level: 10, price: 30, supplier_id: 3 },
        { name: 'Herbal Soap', category: 'finished goods', quantity: 22, reorder_level: 15, price: 45, supplier_id: 3 },
        { name: 'Detergent Powder', category: 'packaging', quantity: 5, reorder_level: 8, price: 80, supplier_id: 1 },
        { name: 'Table Salt', category: 'raw material', quantity: 18, reorder_level: 12, price: 20, supplier_id: 2 },
        { name: 'Pasta', category: 'finished goods', quantity: 7, reorder_level: 10, price: 55, supplier_id: 3 },
        { name: 'Tomato Ketchup', category: 'finished goods', quantity: 4, reorder_level: 8, price: 95, supplier_id: 1 }
    ];

    for (const item of stockItems) {
        await db.run(
            'INSERT INTO stock_items (name, category, quantity, reorder_level, price, supplier_id) VALUES (?, ?, ?, ?, ?, ?)',
            [item.name, item.category, item.quantity, item.reorder_level, item.price, item.supplier_id]
        );
    }

    // Insert Transactions (Last 30 days)
    const transactions = [
        // Income entries
        { type: 'income', amount: 15000, description: 'Bulk order from Hotel Grand', category: 'wholesale', date: '2024-01-15' },
        { type: 'income', amount: 8500, description: 'Retail sales - Week 3', category: 'retail', date: '2024-01-18' },
        { type: 'income', amount: 12000, description: 'Online order - Amazon', category: 'ecommerce', date: '2024-01-20' },
        { type: 'income', amount: 9500, description: 'Local store delivery', category: 'retail', date: '2024-01-22' },
        { type: 'income', amount: 21000, description: 'Corporate order', category: 'wholesale', date: '2024-01-25' },
        { type: 'income', amount: 6700, description: 'Weekend sales', category: 'retail', date: '2024-01-27' },
        { type: 'income', amount: 14500, description: 'Monthly bulk order', category: 'wholesale', date: '2024-01-30' },
        { type: 'income', amount: 8200, description: 'Online sales', category: 'ecommerce', date: '2024-02-01' },
        { type: 'income', amount: 11000, description: 'Store sales', category: 'retail', date: '2024-02-03' },
        { type: 'income', amount: 19000, description: 'Bulk order - Restaurant chain', category: 'wholesale', date: '2024-02-05' },
        
        // Expense entries
        { type: 'expense', amount: 5000, description: 'Rent payment', category: 'rent', date: '2024-01-16' },
        { type: 'expense', amount: 3200, description: 'Electricity bill', category: 'utilities', date: '2024-01-17' },
        { type: 'expense', amount: 15000, description: 'Supplier payment - Wholesale Mart', category: 'purchase', date: '2024-01-19' },
        { type: 'expense', amount: 2000, description: 'Cleaning service', category: 'maintenance', date: '2024-01-21' },
        { type: 'expense', amount: 4500, description: 'Employee salary', category: 'salary', date: '2024-01-23' },
        { type: 'expense', amount: 1800, description: 'Internet bill', category: 'utilities', date: '2024-01-24' },
        { type: 'expense', amount: 8000, description: 'Raw material purchase', category: 'purchase', date: '2024-01-26' },
        { type: 'expense', amount: 1200, description: 'Office supplies', category: 'misc', date: '2024-01-28' },
        { type: 'expense', amount: 3500, description: 'Transportation', category: 'logistics', date: '2024-01-29' },
        { type: 'expense', amount: 6000, description: 'Marketing campaign', category: 'marketing', date: '2024-01-31' },
        { type: 'expense', amount: 4200, description: 'Water bill', category: 'utilities', date: '2024-02-02' },
        { type: 'expense', amount: 9500, description: 'Supplier payment - Anand Traders', category: 'purchase', date: '2024-02-04' }
    ];

    for (const transaction of transactions) {
        await db.run(
            'INSERT INTO transactions (type, amount, description, category, date) VALUES (?, ?, ?, ?, ?)',
            [transaction.type, transaction.amount, transaction.description, transaction.category, transaction.date]
        );
    }

    // Insert stock movement logs
    const stockMovements = [
        { item_id: 2, movement_type: 'out', quantity: 5, reason: 'Customer purchase' },
        { item_id: 3, movement_type: 'out', quantity: 3, reason: 'Retail sale' },
        { item_id: 5, movement_type: 'out', quantity: 8, reason: 'Bulk order' },
        { item_id: 7, movement_type: 'out', quantity: 4, reason: 'Customer purchase' },
        { item_id: 1, movement_type: 'in', quantity: 20, reason: 'New stock arrival' }
    ];

    for (const movement of stockMovements) {
        await db.run(
            'INSERT INTO stock_movement_log (item_id, movement_type, quantity, reason) VALUES (?, ?, ?, ?)',
            [movement.item_id, movement.movement_type, movement.quantity, movement.reason]
        );
    }

    console.log('Demo data seeded successfully!');
    console.log(`Added ${suppliers.length} suppliers`);
    console.log(`Added ${stockItems.length} stock items`);
    console.log(`Added ${transactions.length} transactions`);
}

// Run seed if executed directly
if (require.main === module) {
    seedDatabase().catch(console.error);
}

module.exports = seedDatabase;