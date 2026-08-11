const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { authenticateToken, requireAdmin, requirePermission } = require('../middleware/auth');

router.use(authenticateToken, requireAdmin);

// ── STATS ──────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE status != 'cancelado'").get().s;
    const totalCustomers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get().c;
    const totalProducts = db.prepare('SELECT COUNT(*) as c FROM products WHERE active = 1').get().c;
    const recentOrders = db.prepare('SELECT id, customer_name, customer_email, total, status, payment_status, payment_method, created_at FROM orders ORDER BY created_at DESC LIMIT 5').all();
    res.json({ totalOrders, totalRevenue, totalCustomers, totalProducts, recentOrders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estadisticas' });
  }
});

// ── ORDERS ─────────────────────────────────────────────
router.get('/orders', (req, res) => {
  try {
    const { status } = req.query;
    let q = 'SELECT o.*, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1';
    const params = [];
    if (status) { q += ' AND o.status = ?'; params.push(status); }
    q += ' ORDER BY o.created_at DESC';
    res.json(db.prepare(q).all(...params));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

router.get('/orders/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT o.*, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ ...order, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// ── CUSTOMERS ──────────────────────────────────────────
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at, COUNT(o.id) as order_count
      FROM users u LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.role = 'customer'
      GROUP BY u.id ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// ── CATEGORIES ─────────────────────────────────────────
router.get('/categories', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM categories ORDER BY id').all());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener categorias' });
  }
});

router.post('/categories', requirePermission('categories'), (req, res) => {
  try {
    const { name, slug, icon, active } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });
    const existing = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
    if (existing) return res.status(400).json({ error: 'Ya existe una categoria con ese slug' });
    const result = db.prepare('INSERT INTO categories (name, slug, icon, active) VALUES (?, ?, ?, ?)').run(name, slug, icon || '', active !== false ? 1 : 0);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear categoria' });
  }
});

router.put('/categories/:id', requirePermission('categories'), (req, res) => {
  try {
    const { name, slug, icon, active } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Nombre y slug son requeridos' });
    db.prepare('UPDATE categories SET name=?, slug=?, icon=?, active=? WHERE id=?').run(name, slug, icon || '', active ? 1 : 0, req.params.id);
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar categoria' });
  }
});

router.delete('/categories/:id', requirePermission('categories'), (req, res) => {
  try {
    const inUse = db.prepare('SELECT COUNT(*) as c FROM products WHERE category_id = ?').get(req.params.id).c;
    if (inUse > 0) return res.status(400).json({ error: 'No se puede eliminar: tiene productos asignados' });
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: 'Categoria eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar categoria' });
  }
});

// ── ADMIN USERS ────────────────────────────────────────
router.get('/admins', requirePermission('admins'), (req, res) => {
  try {
    const admins = db.prepare("SELECT id, name, email, phone, permissions, created_at FROM users WHERE role = 'admin' ORDER BY created_at").all();
    res.json(admins);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener administradores' });
  }
});

router.post('/admins', requirePermission('admins'), (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contrasena son requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    const hashed = bcrypt.hashSync(password, 10);
    const permsValue = permissions && permissions !== 'all' ? JSON.stringify(permissions) : null;
    const result = db.prepare('INSERT INTO users (name, email, password, role, permissions) VALUES (?, ?, ?, ?, ?)').run(name, email, hashed, 'admin', permsValue);
    const admin = db.prepare('SELECT id, name, email, phone, permissions, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(admin);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear administrador' });
  }
});

router.put('/admins/:id', requirePermission('admins'), (req, res) => {
  try {
    const { name, email, phone, permissions, password } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Nombre y email son requeridos' });
    const permsValue = permissions && permissions !== 'all' ? JSON.stringify(permissions) : null;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
      const hashed = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET name=?, email=?, phone=?, permissions=?, password=? WHERE id=? AND role=?').run(name, email, phone || null, permsValue, hashed, req.params.id, 'admin');
    } else {
      db.prepare('UPDATE users SET name=?, email=?, phone=?, permissions=? WHERE id=? AND role=?').run(name, email, phone || null, permsValue, req.params.id, 'admin');
    }
    const admin = db.prepare('SELECT id, name, email, phone, permissions, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json(admin);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar administrador' });
  }
});

router.delete('/admins/:id', requirePermission('admins'), (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    db.prepare("DELETE FROM users WHERE id = ? AND role = 'admin'").run(req.params.id);
    res.json({ message: 'Administrador eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar administrador' });
  }
});

module.exports = router;
