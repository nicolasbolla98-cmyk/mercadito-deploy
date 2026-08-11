const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// GET /api/payments/status/:order_id - consultar estado de pago
router.get('/status/:order_id', (req, res) => {
  try {
    const order = db.prepare('SELECT id, status, payment_status, payment_method FROM orders WHERE id = ?').get(req.params.order_id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(order);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
