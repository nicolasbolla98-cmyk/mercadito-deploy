const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/products/categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY id').all();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// GET /api/products
router.get('/', (req, res) => {
  try {
    const { category, search, all } = req.query;
    let query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // Show inactive products only if ?all=true (admin)
    if (all !== 'true') {
      query += ' AND p.active = 1';
    }

    if (category) {
      query += ' AND c.slug = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND p.name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY p.name ASC';

    const products = db.prepare(query).all(...params);
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// POST /api/products
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description, price, stock, unit, category_id, active } = req.body;

    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({ error: 'Nombre, precio y stock son requeridos' });
    }

    const result = db.prepare(`
      INSERT INTO products (name, description, price, stock, unit, category_id, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      description || null,
      parseFloat(price),
      parseInt(stock),
      unit || 'kg',
      category_id || null,
      active !== undefined ? (active ? 1 : 0) : 1
    );

    const product = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// PUT /api/products/:id
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, description, price, stock, unit, category_id, active } = req.body;

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    db.prepare(`
      UPDATE products
      SET name = ?, description = ?, price = ?, stock = ?, unit = ?, category_id = ?, active = ?
      WHERE id = ?
    `).run(
      name,
      description || null,
      parseFloat(price),
      parseInt(stock),
      unit || 'kg',
      category_id || null,
      active !== undefined ? (active ? 1 : 0) : 1,
      req.params.id
    );

    const product = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(req.params.id);

    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Producto desactivado correctamente' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
