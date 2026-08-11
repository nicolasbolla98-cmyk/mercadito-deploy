import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

const ALL_STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'en_preparacion', label: 'En preparación' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
]

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  const fetchOrders = useCallback(() => {
    const params = statusFilter ? { status: statusFilter } : {}
    return api.get('/api/admin/orders', { params })
      .then(res => setOrders(res.data))
      .catch(err => setError(err.response?.data?.error || 'Error al cargar pedidos'))
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    fetchOrders().finally(() => setLoading(false))
  }, [fetchOrders])

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const openOrderModal = async (orderId) => {
    try {
      const res = await api.get(`/api/admin/orders/${orderId}`)
      setSelectedOrder(res.data)
      setModalOpen(true)
    } catch (err) {
      setError('Error al cargar el pedido')
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedOrder(null)
  }

  const handleStatusChange = async (orderId, newStatus) => {
    setStatusUpdating(true)
    try {
      const res = await api.patch(`/api/admin/orders/${orderId}/status`, { status: newStatus })
      setSelectedOrder(res.data)
      await fetchOrders()
      showSuccess('Estado actualizado correctamente')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar estado')
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Pedidos</h1>
        <p>Gestioná todos los pedidos de los clientes</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Status filter tabs */}
      <div className="status-tabs">
        {ALL_STATUSES.map(s => (
          <button
            key={s.value}
            className={`status-tab ${statusFilter === s.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(s.value)}
          >
            {s.label}
            {s.value === '' && orders.length > 0 && ` (${orders.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Cargando pedidos...</div>
      ) : (
        <div className="table-card">
          <div className="table-header">
            <h2>
              {statusFilter
                ? `Pedidos: ${ALL_STATUSES.find(s => s.value === statusFilter)?.label}`
                : 'Todos los Pedidos'}
              {' '}({orders.length})
            </h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} style={{ cursor: 'pointer' }}>
                  <td><strong>#{order.id}</strong></td>
                  <td style={{ color: 'var(--gray)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {new Date(order.created_at).toLocaleDateString('es-UY', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{order.customer_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>{order.customer_email}</div>
                    {order.customer_phone && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>{order.customer_phone}</div>
                    )}
                  </td>
                  <td>
                    <strong style={{ color: 'var(--green)' }}>
                      ${Number(order.total).toLocaleString('es-UY')}
                    </strong>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span className={`badge badge-${order.status}`}>
                        {ALL_STATUSES.find(s => s.value === order.status)?.label || order.status}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openOrderModal(order.id)}
                    >
                      👁️ Ver
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray)', padding: '2rem' }}>
                    No hay pedidos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Detail Modal */}
      {modalOpen && selectedOrder && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal" style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h2 className="modal-title">Pedido #{selectedOrder.id}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {/* Customer info */}
            <div className="order-detail-grid">
              <div className="order-detail-field">
                <label>Cliente</label>
                <span>{selectedOrder.customer_name}</span>
              </div>
              <div className="order-detail-field">
                <label>Email</label>
                <span>{selectedOrder.customer_email}</span>
              </div>
              <div className="order-detail-field">
                <label>Teléfono</label>
                <span>{selectedOrder.customer_phone || '—'}</span>
              </div>
              <div className="order-detail-field">
                <label>Fecha</label>
                <span>{new Date(selectedOrder.created_at).toLocaleDateString('es-UY', {
                  year: 'numeric', month: 'long', day: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}</span>
              </div>
              {selectedOrder.customer_address && (
                <div className="order-detail-field" style={{ gridColumn: '1/-1' }}>
                  <label>Dirección</label>
                  <span>{selectedOrder.customer_address}</span>
                </div>
              )}
              {selectedOrder.notes && (
                <div className="order-detail-field" style={{ gridColumn: '1/-1' }}>
                  <label>Observaciones</label>
                  <span>{selectedOrder.notes}</span>
                </div>
              )}
              <div className="order-detail-field">
                <label>Medio de pago</label>
                <span style={{ textTransform: 'capitalize' }}>{selectedOrder.payment_method || 'efectivo'}</span>
              </div>
              <div className="order-detail-field">
                <label>Estado de pago</label>
                <span className={`badge badge-${selectedOrder.payment_status === 'pagado' ? 'pagado' : selectedOrder.payment_status === 'rechazado' ? 'rechazado' : 'en_proceso'}`}>
                  {selectedOrder.payment_status || 'pendiente'}
                </span>
              </div>
            </div>

            {/* Items */}
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', marginTop: '1rem' }}>
              Productos
            </h3>
            <table style={{ marginBottom: '1rem' }}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio Unit.</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items?.map(item => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>${Number(item.product_price).toLocaleString('es-UY')}</td>
                    <td>{item.quantity}</td>
                    <td><strong style={{ color: 'var(--green)' }}>${Number(item.subtotal).toLocaleString('es-UY')}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{
              display: 'flex', justifyContent: 'flex-end',
              fontWeight: 700, fontSize: '1.1rem', color: 'var(--green)',
              marginBottom: '1rem'
            }}>
              Total: ${Number(selectedOrder.total).toLocaleString('es-UY')}
            </div>

            {/* Status change */}
            <div style={{ background: 'var(--light)', padding: '1rem', borderRadius: '10px' }}>
              <label className="form-label">Cambiar estado del pedido:</label>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <select
                  className="form-select"
                  style={{ flex: 1, minWidth: 200 }}
                  value={selectedOrder.status}
                  onChange={e => handleStatusChange(selectedOrder.id, e.target.value)}
                  disabled={statusUpdating}
                >
                  {ALL_STATUSES.filter(s => s.value).map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <span className={`badge badge-${selectedOrder.status}`}>
                  {ALL_STATUSES.find(s => s.value === selectedOrder.status)?.label}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
