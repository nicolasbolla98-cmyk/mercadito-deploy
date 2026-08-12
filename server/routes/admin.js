const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db/database');
const { authenticateToken, requireAdmin, requirePermission } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

// ── STATS ──────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const totalOrders    = (await pool.query('SELECT COUNT(*) as c FROM orders')).rows[0].c;
    const totalRevenue   = (await pool.query("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelado'")).rows[0].s;
    const totalCustomers = (await pool.query("SELECT COUNT(*) as c FROM users WHERE role = 'customer'")).rows[0].c;
    const totalProducts  = (await pool.query('SELECT COUNT(*) as c FROM products WHERE active = 1')).rows[0].c;
    const recentOrders   = (await pool.query('SELECT id,customer_name,customer_email,total,status,payment_status,payment_method,created_at FROM orders ORDER BY created_at DESC LIMIT 5')).rows;
    res.json({ totalOrders, totalRevenue, totalCustomers, totalProducts, recentOrders });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// ── ORDERS ─────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const { status, payment_status } = req.query;
    let q = 'SELECT o.*, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1';
    const params = [];
    let paramIdx = 1;
    if (status)         { q += ` AND o.status = $${paramIdx++}`;         params.push(status); }
    if (payment_status) { q += ` AND o.payment_status = $${paramIdx++}`; params.push(payment_status); }
    q += ' ORDER BY o.created_at DESC';
    const rows = (await pool.query(q, params)).rows;
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const order = (await pool.query(
      'SELECT o.*, u.name as user_name, u.id as user_id_ref FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = $1',
      [req.params.id]
    )).rows[0];
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    const items = (await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id])).rows;
    res.json({ ...order, items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pendiente', 'confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado'];
    if (!status || !valid.includes(status)) return res.status(400).json({ error: 'Estado invalido' });
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    const order = (await pool.query(
      'SELECT o.*, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = $1',
      [req.params.id]
    )).rows[0];
    const items = (await pool.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id])).rows;
    res.json({ ...order, items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// Marcar pago manualmente (uno o varios pedidos)
router.post('/orders/confirm-payment', async (req, res) => {
  const client = await pool.connect();
  try {
    const { order_ids, payment_method } = req.body;
    if (!Array.isArray(order_ids) || order_ids.length === 0) return res.status(400).json({ error: 'order_ids requeridos' });

    const validMethods = ['efectivo', 'transferencia', 'credito'];
    const method = validMethods.includes(payment_method) ? payment_method : 'efectivo';

    // Si es credito, necesitamos descontar del saldo del cliente
    if (method === 'credito') {
      const userTotals = {};
      for (const id of order_ids) {
        const order = (await pool.query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];
        if (order && order.user_id && order.payment_status !== 'pagado') {
          userTotals[order.user_id] = (userTotals[order.user_id] || 0) + order.total;
        }
      }
      for (const [userId, totalDebt] of Object.entries(userTotals)) {
        const user = (await pool.query('SELECT credit_balance FROM users WHERE id = $1', [userId])).rows[0];
        if (!user || user.credit_balance < totalDebt) {
          return res.status(400).json({ error: `Credito insuficiente para el cliente #${String(userId).padStart(5, '0')}` });
        }
        await client.query('UPDATE users SET credit_balance = credit_balance - $1 WHERE id = $2', [totalDebt, userId]);
      }
    }

    await client.query('BEGIN');
    for (const id of order_ids) {
      await client.query(
        `UPDATE orders SET payment_status = 'pagado', payment_method = $1, status = CASE WHEN status = 'pendiente' THEN 'confirmado' ELSE status END WHERE id = $2 AND payment_status != 'pagado'`,
        [method, id]
      );
    }
    await client.query('COMMIT');

    res.json({ message: `${order_ids.length} pedido(s) marcado(s) como pagado(s)` });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error al confirmar pago' });
  } finally {
    client.release();
  }
});

// ── CUSTOMERS ──────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = (await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.credit_balance, u.created_at,
             COUNT(o.id) as order_count,
             COALESCE(SUM(CASE WHEN o.payment_status != 'pagado' AND o.status != 'cancelado' THEN o.total ELSE 0 END), 0) as deuda_total
      FROM users u LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.role = 'customer'
      GROUP BY u.id ORDER BY u.created_at DESC
    `)).rows;
    res.json(users);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// Ajustar credito de un cliente
router.patch('/users/:id/credit', requirePermission('customers'), async (req, res) => {
  try {
    const { amount, operation } = req.body;
    const value = parseFloat(amount);
    if (isNaN(value) || value < 0) return res.status(400).json({ error: 'Monto invalido' });

    const user = (await pool.query("SELECT id, credit_balance FROM users WHERE id = $1 AND role = 'customer'", [req.params.id])).rows[0];
    if (!user) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (operation === 'add') {
      await pool.query('UPDATE users SET credit_balance = credit_balance + $1 WHERE id = $2', [value, req.params.id]);
    } else if (operation === 'subtract') {
      const newBalance = Math.max(0, user.credit_balance - value);
      await pool.query('UPDATE users SET credit_balance = $1 WHERE id = $2', [newBalance, req.params.id]);
    } else {
      await pool.query('UPDATE users SET credit_balance = $1 WHERE id = $2', [value, req.params.id]);
    }

    const updated = (await pool.query('SELECT id, name, email, credit_balance FROM users WHERE id = $1', [req.params.id])).rows[0];
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al actualizar credito' }); }
});

// Pedidos de un cliente
router.get('/users/:id/orders', async (req, res) => {
  try {
    const orders = (await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.params.id])).rows;
    res.json(orders);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// ── CATEGORIES ─────────────────────────────────────────
router.get('/categories', async (req, res) => {
  try {
    const rows = (await pool.query('SELECT * FROM categories ORDER BY id')).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.post('/categories', requirePermission('categories'), async (req, res) => {
  try {
    const { name, slug, icon, active } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });
    const existing = (await pool.query('SELECT id FROM categories WHERE slug = $1', [slug])).rows[0];
    if (existing) return res.status(400).json({ error: 'Slug ya existe' });
    const result = await pool.query(
      'INSERT INTO categories (name, slug, icon, active) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, slug, icon || '', active !== false ? 1 : 0]
    );
    const category = (await pool.query('SELECT * FROM categories WHERE id = $1', [result.rows[0].id])).rows[0];
    res.status(201).json(category);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.put('/categories/:id', requirePermission('categories'), async (req, res) => {
  try {
    const { name, slug, icon, active } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });
    await pool.query(
      'UPDATE categories SET name=$1, slug=$2, icon=$3, active=$4 WHERE id=$5',
      [name, slug, icon || '', active ? 1 : 0, req.params.id]
    );
    const category = (await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id])).rows[0];
    res.json(category);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/categories/:id', requirePermission('categories'), async (req, res) => {
  try {
    const count = (await pool.query('SELECT COUNT(*) as c FROM products WHERE category_id = $1', [req.params.id])).rows[0].c;
    if (parseInt(count, 10) > 0) return res.status(400).json({ error: 'Tiene productos asignados' });
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Eliminada' });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ── ADMINS ─────────────────────────────────────────────
router.get('/admins', requirePermission('admins'), async (req, res) => {
  try {
    const rows = (await pool.query("SELECT id,name,email,phone,permissions,created_at FROM users WHERE role='admin' ORDER BY created_at")).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.post('/admins', requirePermission('admins'), async (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contrasena son requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'Contrasena min 6 caracteres' });
    const existing = (await pool.query('SELECT id FROM users WHERE email = $1', [email])).rows[0];
    if (existing) return res.status(400).json({ error: 'Email ya existe' });
    const hash = bcrypt.hashSync(password, 10);
    const perms = permissions && permissions !== 'all' ? JSON.stringify(permissions) : null;
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, permissions) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, email, hash, 'admin', perms]
    );
    const admin = (await pool.query('SELECT id,name,email,phone,permissions,created_at FROM users WHERE id = $1', [result.rows[0].id])).rows[0];
    res.status(201).json(admin);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.put('/admins/:id', requirePermission('admins'), async (req, res) => {
  try {
    const { name, email, phone, permissions, password } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Nombre y email requeridos' });
    const perms = permissions && permissions !== 'all' ? JSON.stringify(permissions) : null;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Contrasena min 6 caracteres' });
      await pool.query(
        "UPDATE users SET name=$1, email=$2, phone=$3, permissions=$4, password=$5 WHERE id=$6 AND role='admin'",
        [name, email, phone || null, perms, bcrypt.hashSync(password, 10), req.params.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET name=$1, email=$2, phone=$3, permissions=$4 WHERE id=$5 AND role='admin'",
        [name, email, phone || null, perms, req.params.id]
      );
    }
    const admin = (await pool.query('SELECT id,name,email,phone,permissions,created_at FROM users WHERE id = $1', [req.params.id])).rows[0];
    res.json(admin);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/admins/:id', requirePermission('admins'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    await pool.query("DELETE FROM users WHERE id=$1 AND role='admin'", [req.params.id]);
    res.json({ message: 'Eliminado' });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// Aprobar pedido fiado
router.patch('/orders/:id/approve-fiado', async (req, res) => {
  try {
    const order = (await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id])).rows[0];
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    await pool.query(
      "UPDATE orders SET payment_status='aprobado', status=CASE WHEN status='pendiente' THEN 'confirmado' ELSE status END WHERE id=$1",
      [req.params.id]
    );
    const updated = (await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0];
    res.json(updated);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// Rechazar pedido fiado
router.patch('/orders/:id/reject-fiado', async (req, res) => {
  try {
    await pool.query("UPDATE orders SET payment_status='rechazado', status='cancelado' WHERE id=$1", [req.params.id]);
    const updated = (await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0];
    res.json(updated);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// Saldar deuda fiado
router.patch('/orders/:id/saldar', async (req, res) => {
  try {
    await pool.query("UPDATE orders SET payment_status='saldado' WHERE id=$1", [req.params.id]);
    const updated = (await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0];
    res.json(updated);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// Lista de deudas (pedidos fiado aprobados sin saldar)
router.get('/deudas', async (req, res) => {
  try {
    const orders = (await pool.query(`
      SELECT o.*, u.name as user_name, u.phone as user_phone
      FROM orders o LEFT JOIN users u ON o.user_id = u.id
      WHERE o.payment_method = 'fiado' AND o.payment_status = 'aprobado'
      ORDER BY o.created_at ASC
    `)).rows;
    const map = {};
    for (const o of orders) {
      const key = o.user_id || o.customer_email;
      if (!map[key]) map[key] = { id: o.user_id, name: o.customer_name, email: o.customer_email, phone: o.customer_phone || o.user_phone, orders: [], total_deuda: 0 };
      map[key].orders.push(o);
      map[key].total_deuda += o.total;
    }
    res.json(Object.values(map));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ── SETTINGS ───────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const rows = (await pool.query('SELECT key, value FROM settings')).rows;
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.put('/settings', requirePermission('settings'), async (req, res) => {
  try {
    const allowed = ['store_name', 'whatsapp', 'address', 'hours', 'bank_name', 'bank_account_holder', 'bank_account_number', 'bank_extra', 'transfer_note'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await pool.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
          [key, req.body[key]]
        );
      }
    }
    const rows = (await pool.query('SELECT key, value FROM settings')).rows;
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  } catch (e) { res.status(500).json({ error: 'Error al guardar' }); }
});

module.exports = router;
