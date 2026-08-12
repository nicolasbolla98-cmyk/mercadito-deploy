const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const SELECT_PRODUCT = `
  SELECT p.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
`;

router.get('/categories', async (req, res) => {
  try {
    const rows = (await pool.query('SELECT * FROM categories WHERE active = 1 ORDER BY id')).rows;
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener categorias' }); }
});

router.get('/', async (req, res) => {
  try {
    const { category, search, all } = req.query;
    let q = SELECT_PRODUCT + ' WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (all !== 'true') { q += ' AND p.active = 1'; }
    if (category) { q += ` AND c.slug = $${paramIdx++}`; params.push(category); }
    if (search)   { q += ` AND p.name ILIKE $${paramIdx++}`; params.push(`%${search}%`); }
    q += ' ORDER BY p.name ASC';

    const rows = (await pool.query(q, params)).rows;
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al obtener productos' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const product = (await pool.query(SELECT_PRODUCT + ' WHERE p.id = $1', [req.params.id])).rows[0];
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, unit, category_id, active, cajon_price } = req.body;
    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({ error: 'Nombre, precio y stock son requeridos' });
    }
    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock, unit, category_id, active, cajon_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        name,
        description || null,
        parseFloat(price),
        parseInt(stock),
        unit || 'kg',
        category_id || null,
        active !== undefined ? (active ? 1 : 0) : 1,
        cajon_price ? parseFloat(cajon_price) : null,
      ]
    );
    const newId = result.rows[0].id;
    const product = (await pool.query(SELECT_PRODUCT + ' WHERE p.id = $1', [newId])).rows[0];
    res.status(201).json(product);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al crear producto' }); }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, unit, category_id, active, cajon_price } = req.body;
    const existing = (await pool.query('SELECT id FROM products WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

    await pool.query(
      `UPDATE products SET name=$1, description=$2, price=$3, stock=$4, unit=$5, category_id=$6, active=$7, cajon_price=$8 WHERE id=$9`,
      [
        name,
        description || null,
        parseFloat(price),
        parseInt(stock),
        unit || 'kg',
        category_id || null,
        active !== undefined ? (active ? 1 : 0) : 1,
        cajon_price ? parseFloat(cajon_price) : null,
        req.params.id,
      ]
    );
    const product = (await pool.query(SELECT_PRODUCT + ' WHERE p.id = $1', [req.params.id])).rows[0];
    res.json(product);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error al actualizar producto' }); }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const existing = (await pool.query('SELECT id FROM products WHERE id = $1', [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
    await pool.query('UPDATE products SET active = 0 WHERE id = $1', [req.params.id]);
    res.json({ message: 'Producto desactivado' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
