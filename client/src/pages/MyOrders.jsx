import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/orders/my')
      .then(res => setOrders(res.data))
      .catch(err => setError(err.response?.data?.error || 'Error al cargar los pedidos'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Cargando tus pedidos...</div>

  return (
    <div>
      <div className="page-header">
        <h1>📦 Mis Pedidos</h1>
        <p>Seguí el estado de tus compras</p>
      </div>

      <div className="section">
        <div className="container" style={{ maxWidth: 800 }}>
          {error && <div className="alert alert-error">{error}</div>}

          {orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <h3>No tenés pedidos aún</h3>
              <p>Cuando hagas tu primer pedido, aparecerá aquí.</p>
              <Link to="/catalogo" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Ver Catálogo
              </Link>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map(order => (
                <div key={order.id} className="order-card">
                  <div className="order-header">
                    <div>
                      <div className="order-id">Pedido #{order.id}</div>
                      <div className="order-date">
                        {new Date(order.created_at).toLocaleDateString('es-UY', {
                          year: 'numeric', month: 'long', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                    <span className={`badge badge-${order.status}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>

                  <div className="order-items-preview">
                    {order.items?.map((item, i) => (
                      <span key={item.id}>
                        {item.product_name} × {item.quantity}
                        {i < order.items.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>

                  <div className="order-footer">
                    <span className="order-total">
                      Total: ${order.total?.toLocaleString('es-UY')}
                    </span>
                    {order.customer_address && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>
                        📍 {order.customer_address}
                      </span>
                    )}
                  </div>

                  {order.notes && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--gray)', background: 'var(--light)', padding: '0.75rem', borderRadius: '8px' }}>
                      <strong>Nota:</strong> {order.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
