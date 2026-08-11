const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const SELECT_PRODUCT = `
  SELECT p.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
`;

router.get('/categories', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY id').all());
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener categorias' }); }
});

router.get('/', (req, res) => {
  try {
    const { category, search, all } = req.query;
    let q = SELECT_PRODUCT + ' WHERE 1=1';
    const params = [];
    if (all !== 'true') { q += ' AND p.active = 1'; }
    if (category) { q += ' AND c.slug = ?'; params.push(category); }
    if (search) { q += ' AND p.name LIKE ?'; params.push(`%${search}%`); }
    q += ' ORDER BY p.name ASC';
    res.json(db.prepare(q).all(...params));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener productos' }); }
});

router.get('/:id', (req, res) => {
  try {
    const product = db.prepare(SELECT_PRODUCT + ' WHERE p.id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description, price, stock, unit, category_id, active, cajon_price } = req.body;
    if (!name || price === undefined || stock === undefined) return res.status(400).json({ error: 'Nombre, precio y stock son requeridos' });
    const result = db.prepare(`
      INSERT INTO products (name, description, price, stock, unit, category_id, active, cajon_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, description || null, parseFloat(price), parseInt(stock), unit || 'kg', category_id || null, active !== undefined ? (active ? 1 : 0) : 1, cajon_price ? parseFloat(cajon_price) : null);
    res.status(201).json(db.prepare(SELECT_PRODUCT + ' WHERE p.id = ?').get(result.lastInsertRowid));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al crear producto' }); }
});

router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description, price, stock, unit, category_id, active, cajon_price } = req.body;
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Producto no encontrado' });
    db.prepare(`
      UPDATE products SET name=?, description=?, price=?, stock=?, unit=?, category_id=?, active=?, cajon_price=? WHERE id=?
    `).run(name, description || null, parseFloat(price), parseInt(stock), unit || 'kg', category_id || null, active !== undefined ? (active ? 1 : 0) : 1, cajon_price ? parseFloat(cajon_price) : null, req.params.id);
    res.json(db.prepare(SELECT_PRODUCT + ' WHERE p.id = ?').get(req.params.id));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al actualizar producto' }); }
});

router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Producto no encontrado' });
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Producto desactivado' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
