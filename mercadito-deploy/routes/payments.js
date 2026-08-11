const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { db } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

function getMPClient() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return null;
  return new MercadoPagoConfig({ accessToken: token });
}

// POST /api/payments/create-preference
router.post('/create-preference', async (req, res) => {
  try {
    const client = getMPClient();
    if (!client) {
      return res.status(503).json({ error: 'Pago online no disponible actualmente' });
    }

    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id requerido' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order_id);

    const baseUrl = process.env.APP_URL || 'https://mercadito-deploy.onrender.com';

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        external_reference: String(order_id),
        items: items.map(item => ({
          id: String(item.product_id),
          title: item.product_name,
          quantity: item.quantity,
          unit_price: item.product_price,
          currency_id: 'UYU',
        })),
        payer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone ? { number: order.customer_phone } : undefined,
        },
        back_urls: {
          success: `${baseUrl}/pago/resultado?status=approved&order_id=${order_id}`,
          failure: `${baseUrl}/pago/resultado?status=failure&order_id=${order_id}`,
          pending: `${baseUrl}/pago/resultado?status=pending&order_id=${order_id}`,
        },
        auto_return: 'approved',
        notification_url: `${baseUrl}/api/payments/webhook`,
        statement_descriptor: 'Mercadito la U',
      },
    });

    // Update order with MP preference id
    db.prepare("UPDATE orders SET payment_method='mercadopago', payment_id=? WHERE id=?")
      .run(result.id, order_id);

    res.json({
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
      preference_id: result.id,
    });
  } catch (error) {
    console.error('MP create preference error:', error);
    res.status(500).json({ error: 'Error al crear preferencia de pago' });
  }
});

// POST /api/payments/webhook - Mercado Pago IPN
router.post('/webhook', async (req, res) => {
  try {
    const client = getMPClient();
    if (!client) return res.sendStatus(200);

    const { type, data } = req.body;
    if (type !== 'payment' || !data?.id) return res.sendStatus(200);

    const payment = new Payment(client);
    const paymentData = await payment.get({ id: data.id });

    const orderId = paymentData.external_reference;
    const status = paymentData.status;

    if (orderId) {
      let paymentStatus = 'pendiente';
      let orderStatus = 'pendiente';

      if (status === 'approved') {
        paymentStatus = 'pagado';
        orderStatus = 'confirmado';
      } else if (status === 'rejected' || status === 'cancelled') {
        paymentStatus = 'rechazado';
      } else if (status === 'in_process' || status === 'pending') {
        paymentStatus = 'en_proceso';
      }

      db.prepare("UPDATE orders SET payment_status=?, status=?, payment_id=? WHERE id=?")
        .run(paymentStatus, orderStatus, String(data.id), orderId);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('MP webhook error:', error);
    res.sendStatus(200);
  }
});

// GET /api/payments/status/:order_id
router.get('/status/:order_id', async (req, res) => {
  try {
    const order = db.prepare('SELECT id, status, payment_status, payment_method, payment_id FROM orders WHERE id = ?').get(req.params.order_id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al consultar estado de pago' });
  }
});

module.exports = router;
