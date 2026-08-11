const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

function optionalAuth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch {}
  }
  next();
}

// POST /api/orders
router.post('/', optionalAuth, (req, res) => {
  try {
    const { customer_name, customer_email, customer_phone, customer_address, notes, items, payment_method } = req.body;

    if (!customer_name || !customer_email) return res.status(400).json({ error: 'Nombre y email requeridos' });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });

    const method = ['efectivo', 'credito', 'transferencia'].includes(payment_method) ? payment_method : 'efectivo';

    let total = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id);
      if (!product) return res.status(400).json({ error: `Producto ${item.product_id} no encontrado` });
      const quantity = parseFloat(item.quantity);
      if (quantity <= 0) return res.status(400).json({ error: 'Cantidad invalida' });
      // Use cajon_price when buying by cajón
      const isCajon = item.cajon === true && product.cajon_price;
      const unitPrice = isCajon ? product.cajon_price : product.price;
      const productName = isCajon ? `${product.name} (cajon)` : product.name;
      const subtotal = unitPrice * quantity;
      total += subtotal;
      validatedItems.push({ product_id: product.id, product_name: productName, product_price: unitPrice, quantity, subtotal });
    }

    // Si paga con credito, verificar saldo
    if (method === 'credito') {
      if (!req.user) return res.status(400).json({ error: 'Debes iniciar sesion para pagar con credito' });
      const user = db.prepare('SELECT credit_balance FROM users WHERE id = ?').get(req.user.id);
      if (!user || user.credit_balance < total) {
        return res.status(400).json({ error: `Credito insuficiente. Saldo disponible: $${user?.credit_balance?.toLocaleString('es-UY') || 0}` });
      }
    }

    const createOrder = db.transaction(() => {
      // Si paga con credito, descontar saldo
      let paymentStatus = 'pendiente';
      if (method === 'credito') {
        db.prepare('UPDATE users SET credit_balance = credit_balance - ? WHERE id = ?').run(total, req.user.id);
        paymentStatus = 'pagado';
      }

      const r = db.prepare(`
        INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, customer_address, notes, total, status, payment_method, payment_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)
      `).run(req.user?.id || null, customer_name, customer_email, customer_phone || null, customer_address || null, notes || null, total, method, paymentStatus);

      const orderId = r.lastInsertRowid;
      const ins = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)');
      for (const item of validatedItems) ins.run(orderId, item.product_id, item.product_name, item.product_price, item.quantity, item.subtotal);
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
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(orders.map(o => ({ ...o, items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ ...order, items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

module.exports = router;
