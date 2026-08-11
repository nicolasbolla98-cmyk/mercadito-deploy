const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// Optional auth middleware (doesn't fail if no token)
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      // ignore invalid tokens for guest checkout
    }
  }
  next();
}

// POST /api/orders
router.post('/', optionalAuth, (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_address, notes, items, payment_method } = req.body;

    if (!customer_name || !customer_email) {
      return res.status(400).json({ error: 'Nombre y email del cliente son requeridos' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });
    }

    // Validate items and calculate total server-side
    let total = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id);
      if (!product) {
        return res.status(400).json({ error: `Producto con id ${item.product_id} no encontrado` });
      }
      const quantity = parseFloat(item.quantity);
      if (quantity <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
      }
      const subtotal = product.price * quantity;
      total += subtotal;
      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        quantity,
        subtotal,
      });
    }

    // Create order in a transaction
    const createOrder = db.transaction(() => {
      const orderResult = db.prepare(`
        INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, customer_address, notes, total, status, payment_method)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
      `).run(
        req.user ? req.user.id : null,
        customer_name,
        customer_email,
        customer_phone || null,
        customer_address || null,
        notes || null,
        total,
        payment_method || 'efectivo'
      );

      const orderId = orderResult.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of validatedItems) {
        insertItem.run(orderId, item.product_id, item.product_name, item.product_price, item.quantity, item.subtotal);
      }

      return orderId;
    });

    const orderId = createOrder();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    res.status(201).json({ ...order, items: orderItems });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Error al crear el pedido' });
  }
});

// GET /api/orders/my
router.get('/my', authenticateToken, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);

    const ordersWithItems = orders.map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return { ...order, items };
    });

    res.json(ordersWithItems);
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ ...order, items });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

module.exports = router;
