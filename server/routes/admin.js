const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { authenticateToken, requireAdmin, requirePermission } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

// ── STATS ──────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const totalOrders    = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const totalRevenue   = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelado'").get().s;
    const totalCustomers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get().c;
    const totalProducts  = db.prepare('SELECT COUNT(*) as c FROM products WHERE active = 1').get().c;
    const recentOrders   = db.prepare('SELECT id,customer_name,customer_email,total,status,payment_status,payment_method,created_at FROM orders ORDER BY created_at DESC LIMIT 5').all();
    res.json({ totalOrders, totalRevenue, totalCustomers, totalProducts, recentOrders });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// ── ORDERS ─────────────────────────────────────────────
router.get('/orders', (req, res) => {
  try {
    const { status, payment_status } = req.query;
    let q = 'SELECT o.*, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1';
    const params = [];
    if (status)         { q += ' AND o.status = ?';         params.push(status); }
    if (payment_status) { q += ' AND o.payment_status = ?'; params.push(payment_status); }
    q += ' ORDER BY o.created_at DESC';
    res.json(db.prepare(q).all(...params));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

router.get('/orders/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT o.*, u.name as user_name, u.id as user_id_ref FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ ...order, items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

router.patch('/orders/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pendiente','confirmado','en_preparacion','enviado','entregado','cancelado'];
    if (!status || !valid.includes(status)) return res.status(400).json({ error: 'Estado invalido' });
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
    const order = db.prepare('SELECT o.*, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?').get(req.params.id);
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
    res.json({ ...order, items });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// Marcar pago manualmente (uno o varios pedidos)
router.post('/orders/confirm-payment', (req, res) => {
  try {
    const { order_ids, payment_method } = req.body;
    if (!Array.isArray(order_ids) || order_ids.length === 0) return res.status(400).json({ error: 'order_ids requeridos' });

    const validMethods = ['efectivo', 'transferencia', 'credito'];
    const method = validMethods.includes(payment_method) ? payment_method : 'efectivo';

    // Si es credito, necesitamos descontar del saldo del cliente
    if (method === 'credito') {
      // Agrupamos por usuario para descontar el credito
      const userTotals = {};
      for (const id of order_ids) {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (order && order.user_id && order.payment_status !== 'pagado') {
          userTotals[order.user_id] = (userTotals[order.user_id] || 0) + order.total;
        }
      }
      for (const [userId, totalDebt] of Object.entries(userTotals)) {
        const user = db.prepare('SELECT credit_balance FROM users WHERE id = ?').get(userId);
        if (!user || user.credit_balance < totalDebt) {
          return res.status(400).json({ error: `Credito insuficiente para el cliente #${String(userId).padStart(5,'0')}` });
        }
        db.prepare('UPDATE users SET credit_balance = credit_balance - ? WHERE id = ?').run(totalDebt, userId);
      }
    }

    const stmt = db.prepare("UPDATE orders SET payment_status = 'pagado', payment_method = ?, status = CASE WHEN status = 'pendiente' THEN 'confirmado' ELSE status END WHERE id = ? AND payment_status != 'pagado'");
    for (const id of order_ids) stmt.run(method, id);

    res.json({ message: `${order_ids.length} pedido(s) marcado(s) como pagado(s)` });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al confirmar pago' }); }
});

// ── CUSTOMERS ──────────────────────────────────────────
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.credit_balance, u.created_at,
             COUNT(o.id) as order_count,
             COALESCE(SUM(CASE WHEN o.payment_status != 'pagado' AND o.status != 'cancelado' THEN o.total ELSE 0 END), 0) as deuda_total
      FROM users u LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.role = 'customer'
      GROUP BY u.id ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// Ajustar credito de un cliente
router.patch('/users/:id/credit', requirePermission('customers'), (req, res) => {
  try {
    const { amount, operation } = req.body; // operation: 'set' | 'add' | 'subtract'
    const value = parseFloat(amount);
    if (isNaN(value) || value < 0) return res.status(400).json({ error: 'Monto invalido' });

    const user = db.prepare("SELECT id, credit_balance FROM users WHERE id = ? AND role = 'customer'").get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (operation === 'add') {
      db.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?').run(value, req.params.id);
    } else if (operation === 'subtract') {
      const newBalance = Math.max(0, user.credit_balance - value);
      db.prepare('UPDATE users SET credit_balance = ? WHERE id = ?').run(newBalance, req.params.id);
    } else {
      db.prepare('UPDATE users SET credit_balance = ? WHERE id = ?').run(value, req.params.id);
    }

    const updated = db.prepare('SELECT id, name, email, credit_balance FROM users WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al actualizar credito' }); }
});

// Pedidos pendientes de un cliente
router.get('/users/:id/orders', (req, res) => {
  try {
    const orders = db.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(req.params.id);
    res.json(orders);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

// ── CATEGORIES ─────────────────────────────────────────
router.get('/categories', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM categories ORDER BY id').all()); }
  catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.post('/categories', requirePermission('categories'), (req, res) => {
  try {
    const { name, slug, icon, active } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });
    if (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) return res.status(400).json({ error: 'Slug ya existe' });
    const r = db.prepare('INSERT INTO categories (name, slug, icon, active) VALUES (?, ?, ?, ?)').run(name, slug, icon || '', active !== false ? 1 : 0);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.put('/categories/:id', requirePermission('categories'), (req, res) => {
  try {
    const { name, slug, icon, active } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });
    db.prepare('UPDATE categories SET name=?, slug=?, icon=?, active=? WHERE id=?').run(name, slug, icon || '', active ? 1 : 0, req.params.id);
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/categories/:id', requirePermission('categories'), (req, res) => {
  try {
    if (db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ?').get(req.params.id).c > 0)
      return res.status(400).json({ error: 'Tiene productos asignados' });
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Eliminada' });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ── ADMINS ─────────────────────────────────────────────
router.get('/admins', requirePermission('admins'), (req, res) => {
  try {
    res.json(db.prepare("SELECT id,name,email,phone,permissions,created_at FROM users WHERE role='admin' ORDER BY created_at").all());
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.post('/admins', requirePermission('admins'), (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contrasena son requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'Contrasena min 6 caracteres' });
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(400).json({ error: 'Email ya existe' });
    const hash = bcrypt.hashSync(password, 10);
    const perms = permissions && permissions !== 'all' ? JSON.stringify(permissions) : null;
    const r = db.prepare('INSERT INTO users (name, email, password, role, permissions) VALUES (?, ?, ?, ?, ?)').run(name, email, hash, 'admin', perms);
    res.status(201).json(db.prepare('SELECT id,name,email,phone,permissions,created_at FROM users WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.put('/admins/:id', requirePermission('admins'), (req, res) => {
  try {
    const { name, email, phone, permissions, password } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Nombre y email requeridos' });
    const perms = permissions && permissions !== 'all' ? JSON.stringify(permissions) : null;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Contrasena min 6 caracteres' });
      db.prepare('UPDATE users SET name=?,email=?,phone=?,permissions=?,password=? WHERE id=? AND role=?').run(name, email, phone||null, perms, bcrypt.hashSync(password,10), req.params.id, 'admin');
    } else {
      db.prepare('UPDATE users SET name=?,email=?,phone=?,permissions=? WHERE id=? AND role=?').run(name, email, phone||null, perms, req.params.id, 'admin');
    }
    res.json(db.prepare('SELECT id,name,email,phone,permissions,created_at FROM users WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/admins/:id', requirePermission('admins'), (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    db.prepare("DELETE FROM users WHERE id=? AND role='admin'").run(req.params.id);
    res.json({ message: 'Eliminado' });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// Aprobar pedido fiado
router.patch('/orders/:id/approve-fiado', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    db.prepare("UPDATE orders SET payment_status='aprobado', status=CASE WHEN status='pendiente' THEN 'confirmado' ELSE status END WHERE id=?").run(req.params.id);
    res.json(db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: 'Error' }); }
});

// Rechazar pedido fiado
router.patch('/orders/:id/reject-fiado', (req, res) => {
  try {
    db.prepare("UPDATE orders SET payment_status='rechazado', status='cancelado' WHERE id=?").run(req.params.id);
    res.json(db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: 'Error' }); }
});

// Saldar deuda fiado
router.patch('/orders/:id/saldar', (req, res) => {
  try {
    db.prepare("UPDATE orders SET payment_status='saldado' WHERE id=?").run(req.params.id);
    res.json(db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id));
  } catch(e) { res.status(500).json({ error: 'Error' }); }
});

// Lista de deudas (pedidos fiado aprobados sin saldar)
router.get('/deudas', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.*, u.name as user_name, u.phone as user_phone
      FROM orders o LEFT JOIN users u ON o.user_id = u.id
      WHERE o.payment_method = 'fiado' AND o.payment_status = 'aprobado'
      ORDER BY o.created_at ASC
    `).all();
    const map = {};
    for (const o of orders) {
      const key = o.user_id || o.customer_email;
      if (!map[key]) map[key] = { id: o.user_id, name: o.customer_name, email: o.customer_email, phone: o.customer_phone || o.user_phone, orders: [], total_deuda: 0 };
      map[key].orders.push(o);
      map[key].total_deuda += o.total;
    }
    res.json(Object.values(map));
  } catch(e) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;

// ── SETTINGS ───────────────────────────────────────────
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.put('/settings', requirePermission('settings'), (req, res) => {
  try {
    const allowed = ['store_name','whatsapp','address','hours','bank_name','bank_account_holder','bank_account_number','bank_extra','transfer_note'];
    const upsert = db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
    for (const key of allowed) {
      if (req.body[key] !== undefined) upsert.run(key, req.body[key]);
    }
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  } catch (e) { res.status(500).json({ error: 'Error al guardar' }); }
});
