const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');

// GET /api/payments/status/:order_id - consultar estado de pago
router.get('/status/:order_id', async (req, res) => {
  try {
    const order = (await pool.query(
      'SELECT id, status, payment_status, payment_method FROM orders WHERE id = $1',
      [req.params.order_id]
    )).rows[0];
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(order);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
