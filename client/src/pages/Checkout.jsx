import { useState, useContext, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CartContext } from '../context/CartContext'
import { AuthContext } from '../context/AuthContext'
import api from '../api/axios'

const CATEGORY_EMOJIS = {
  frutas: '🍎', verduras: '🥦', bebidas: '🥤',
  alimentos: '🥫', mascotas: '🐾', lena: '🪵', limpieza: '🧹'
}

function getEmoji(product) {
  return product.category_slug && CATEGORY_EMOJIS[product.category_slug] ? CATEGORY_EMOJIS[product.category_slug] : '📦'
}


export default function Checkout() {
  const { items, total, clearCart, effectivePrice } = useContext(CartContext)
  const { user } = useContext(AuthContext)

  const [form, setForm] = useState({
    customer_name: user?.name || '',
    customer_email: user?.email || '',
    customer_phone: user?.phone || '',
    customer_address: '',
    notes: '',
  })
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  const [settings, setSettings] = useState({})
  const creditBalance = user?.credit_balance || 0
  const hasEnoughCredit = creditBalance >= total

  useEffect(() => {
    api.get('/api/settings').then(res => setSettings(res.data)).catch(() => {})
  }, [])

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    if (!form.customer_name || !form.customer_email) { setError('El nombre y email son requeridos'); return }
    if (items.length === 0) { setError('Tu carrito esta vacio'); return }
    if (paymentMethod === 'credito' && !hasEnoughCredit) {
      setError(`Credito insuficiente. Tu saldo es $${creditBalance.toLocaleString('es-UY')}`); return
    }

    setLoading(true)
    try {
      const res = await api.post('/api/orders', {
        ...form,
        payment_method: paymentMethod,
        items: items.map(({ product, quantity, mode }) => ({ product_id: product.id, quantity, cajon: mode === 'cajon' })),
      })
      clearCart()
      setSuccess(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar el pedido')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="checkout-page">
        <div className="success-screen">
          <div className="success-icon">{success.payment_method === 'credito' ? '✅' : success.payment_method === 'transferencia' ? '🏦' : '✅'}</div>
          <h2>Pedido Confirmado!</h2>

          {success.payment_method === 'transferencia' ? (
            <div style={{ textAlign: 'left', background: 'var(--light)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <p style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--dark)' }}>Datos para la transferencia:</p>
              {settings.bank_name && <p><strong>Banco:</strong> {settings.bank_name}</p>}
              {settings.bank_account_holder && <p><strong>Titular:</strong> {settings.bank_account_holder}</p>}
              {settings.bank_account_number && <p><strong>Cuenta:</strong> {settings.bank_account_number}</p>}
              {settings.bank_extra && <p><strong>Detalle:</strong> {settings.bank_extra}</p>}
              {!settings.bank_name && !settings.bank_account_number && (
                <p style={{ color: 'var(--gray)' }}>Te contactaremos con los datos para la transferencia.</p>
              )}
              <p style={{ marginTop: '0.75rem', color: 'var(--gray)', fontSize: '0.9rem' }}>
                {settings.transfer_note || 'Una vez realizada la transferencia, envia el comprobante por WhatsApp.'}
              </p>
              <a
                href={`https://wa.me/${settings.whatsapp || '59894022121'}?text=Hola! Realize una transferencia para el Pedido %23${success.id} por $${success.total?.toLocaleString('es-UY')}. Adjunto el comprobante.`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
              >
                Enviar comprobante por WhatsApp
              </a>
            </div>
          ) : success.payment_method === 'credito' ? (
            <p>Tu pedido fue pagado con tu credito disponible. Quedamos a tu disposicion.</p>
          ) : success.payment_method === 'fiado' ? (
            <div style={{ background: '#fef3c7', borderRadius: 10, padding: '1rem', marginBottom: '1rem', textAlign: 'left' }}>
              <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Solicitud de fiado enviada</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--gray)' }}>El negocio revisará tu solicitud y te avisará si fue aprobada. Mientras tanto tu pedido quedó registrado.</p>
            </div>
          ) : (
            <p>Tu pedido fue registrado. Te contactaremos para coordinar la entrega y el pago en efectivo.</p>
          )}

          <div className="success-order-id">Pedido #{success.id}</div>
          <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'var(--gray)' }}>
            Total: <strong style={{ color: 'var(--green)' }}>${success.total?.toLocaleString('es-UY')}</strong>
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user && <Link to="/mis-pedidos" className="btn btn-primary">Ver mis pedidos</Link>}
            <Link to="/catalogo" className="btn btn-secondary">Seguir comprando</Link>
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="checkout-page">
        <div className="empty-state" style={{ maxWidth: 400, margin: '3rem auto' }}>
          <div className="empty-state-icon">🛒</div>
          <h3>Tu carrito esta vacio</h3>
          <p>Agrega productos antes de confirmar el pedido.</p>
          <Link to="/catalogo" className="btn btn-primary" style={{ marginTop: '1rem' }}>Ver Catalogo</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="checkout-page">
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '2rem' }}>Confirmar Pedido</h1>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="checkout-grid">
          <form onSubmit={handleSubmit}>
            <div className="checkout-card">
              <h2>Datos del cliente</h2>
              <div className="form-group">
                <label className="form-label">Nombre completo *</label>
                <input type="text" name="customer_name" className="form-input" value={form.customer_name} onChange={handleChange} placeholder="Tu nombre completo" required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" name="customer_email" className="form-input" value={form.customer_email} onChange={handleChange} placeholder="tu@email.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Telefono</label>
                <input type="tel" name="customer_phone" className="form-input" value={form.customer_phone} onChange={handleChange} placeholder="+598 94 000 000" />
              </div>
              <div className="form-group">
                <label className="form-label">Direccion de entrega (opcional)</label>
                <input type="text" name="customer_address" className="form-input" value={form.customer_address} onChange={handleChange} placeholder="Calle, numero, ciudad" />
              </div>
              <div className="form-group">
                <label className="form-label">Observaciones (opcional)</label>
                <textarea name="notes" className="form-input" value={form.notes} onChange={handleChange} placeholder="Instrucciones especiales, horarios..." rows={3} style={{ resize: 'vertical' }} />
              </div>

              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1.25rem 0 1rem', paddingTop: '1.25rem', borderTop: '2px solid var(--light)' }}>Medio de pago</h2>

              <div className="payment-method-selector">
                <div className={`payment-method-option ${paymentMethod === 'efectivo' ? 'selected' : ''}`} onClick={() => setPaymentMethod('efectivo')}>
                  <div className="payment-method-icon">💵</div>
                  <div className="payment-method-label">Efectivo</div>
                  <div className="payment-method-desc">Pagas al recibir el pedido</div>
                </div>
                <div className={`payment-method-option ${paymentMethod === 'transferencia' ? 'selected' : ''}`} onClick={() => setPaymentMethod('transferencia')}>
                  <div className="payment-method-icon">🏦</div>
                  <div className="payment-method-label">Transferencia</div>
                  <div className="payment-method-desc">Transferis y enviamos el comprobante</div>
                </div>
                {user && creditBalance > 0 && (
                  <div className={`payment-method-option ${paymentMethod === 'credito' ? 'selected' : ''} ${!hasEnoughCredit ? 'credit-insuficiente' : ''}`} onClick={() => setPaymentMethod('credito')}>
                    <div className="payment-method-icon">💳</div>
                    <div className="payment-method-label">Credito</div>
                    <div className="payment-method-desc">
                      Saldo: ${creditBalance.toLocaleString('es-UY')}
                      {!hasEnoughCredit && <span style={{ color: 'var(--danger)', display: 'block' }}>Insuficiente</span>}
                    </div>
                  </div>
                )}
                {user && (
                  <div className={`payment-method-option ${paymentMethod === 'fiado' ? 'selected' : ''}`} onClick={() => setPaymentMethod('fiado')}>
                    <div className="payment-method-icon">🤝</div>
                    <div className="payment-method-label">Pedir fiado</div>
                    <div className="payment-method-desc">El negocio aprueba tu solicitud</div>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                {loading ? 'Procesando...' : 'Confirmar Pedido'}
              </button>
            </div>
          </form>

          <div>
            <div className="checkout-card">
              <h2>Resumen</h2>
              {items.map((item) => {
                const { product, quantity, mode } = item
                const price = effectivePrice(product, mode)
                const isCajon = mode === 'cajon'
                const unitLabel = isCajon ? 'cajón' : product.unit
                return (
                  <div key={item.key} className="checkout-item">
                    <div>
                      <div className="checkout-item-name">{getEmoji(product)} {product.name}{isCajon ? ' (cajón)' : ''}</div>
                      <div className="checkout-item-detail">
                        {!isCajon && product.unit === 'kg'
                          ? `${quantity} kg x $${price.toLocaleString('es-UY')}/kg`
                          : `${quantity} ${unitLabel} x $${price.toLocaleString('es-UY')}`}
                      </div>
                    </div>
                    <div className="checkout-item-price">${(price * quantity).toLocaleString('es-UY')}</div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', marginTop: '0.5rem', borderTop: '2px solid var(--light)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--green)' }}>
                <span>Total</span>
                <span>${total.toLocaleString('es-UY')}</span>
              </div>
              {user && creditBalance > 0 && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#dbeafe', borderRadius: 8, fontSize: '0.85rem', color: '#1e40af' }}>
                  Credito disponible: <strong>${creditBalance.toLocaleString('es-UY')}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
