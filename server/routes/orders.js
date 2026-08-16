const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
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
router.post('/', optionalAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { customer_name, customer_email, customer_phone, customer_address, notes, items, payment_method, transfer_bank } = req.body;

    if (!customer_name || !customer_email) return res.status(400).json({ error: 'Nombre y email requeridos' });
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'El pedido debe tener al menos un producto' });

    const method = ['efectivo', 'credito', 'transferencia', 'fiado'].includes(payment_method) ? payment_method : 'efectivo';

    let total = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = (await pool.query('SELECT * FROM products WHERE id = $1 AND active = 1', [item.product_id])).rows[0];
      if (!product) return res.status(400).json({ error: `Producto ${item.product_id} no encontrado` });
      const quantity = parseFloat(item.quantity);
      if (quantity <= 0) return res.status(400).json({ error: 'Cantidad invalida' });
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
      const user = (await pool.query('SELECT credit_balance FROM users WHERE id = $1', [req.user.id])).rows[0];
      if (!user || user.credit_balance < total) {
        return res.status(400).json({ error: `Credito insuficiente. Saldo disponible: $${user?.credit_balance?.toLocaleString('es-UY') || 0}` });
      }
    }
    // Fiado requiere estar logueado
    if (method === 'fiado' && !req.user) {
      return res.status(400).json({ error: 'Debes iniciar sesion para pedir fiado' });
    }

    await client.query('BEGIN');

    let paymentStatus = 'pendiente';
    if (method === 'credito') {
      await client.query('UPDATE users SET credit_balance = credit_balance - $1 WHERE id = $2', [total, req.user.id]);
      paymentStatus = 'pagado';
    }

    const orderResult = await client.query(
      `INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, customer_address, notes, total, status, payment_method, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente', $8, $9) RETURNING id`,
      [req.user?.id || null, customer_name, customer_email, customer_phone || null, customer_address || null,
        [notes, transfer_bank ? `Banco elegido: ${transfer_bank}` : null].filter(Boolean).join(' | ') || null,
        total, method, paymentStatus]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of validatedItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal) VALUES ($1, $2, $3, $4, $5, $6)',
        [orderId, item.product_id, item.product_name, item.product_price, item.quantity, item.subtotal]
      );
    }

    await client.query('COMMIT');

    const order = (await pool.query('SELECT * FROM orders WHERE id = $1', [orderId])).rows[0];
    const orderItems = (await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId])).rows;
    res.status(201).json({ ...order, items: orderItems });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Error al crear el pedido' });
  } finally {
    client.release();
  }
});

// GET /api/orders/my
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const orders = (await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id])).rows;
    const result = await Promise.all(
      orders.map(async o => {
        const items = (await pool.query('SELECT * FROM order_items WHERE order_id = $1', [o.id])).rows;
        return { ...o, items };
      })
    );
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = (await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id])).rows[0];
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    const items = (await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id])).rows;
    res.json({ ...order, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

module.exports = router;
