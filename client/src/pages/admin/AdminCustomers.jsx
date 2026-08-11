import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

function customerNum(id) {
  return '#' + String(id).padStart(5, '0')
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')

  // Credit modal
  const [creditModal, setCreditModal] = useState(null) // customer object
  const [creditAmount, setCreditAmount] = useState('')
  const [creditOp, setCreditOp] = useState('add')
  const [creditLoading, setCreditLoading] = useState(false)

  // Customer orders modal
  const [ordersModal, setOrdersModal] = useState(null) // customer object
  const [customerOrders, setCustomerOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [bulkPayMethod, setBulkPayMethod] = useState('efectivo')
  const [bulkPayLoading, setBulkPayLoading] = useState(false)

  const fetchCustomers = useCallback(() =>
    api.get('/api/admin/users').then(res => setCustomers(res.data)).catch(() => {}), [])

  useEffect(() => { fetchCustomers().finally(() => setLoading(false)) }, [fetchCustomers])

  const showSuccess = msg => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    customerNum(c.id).includes(search)
  )

  // Credit management
  const openCreditModal = (customer) => {
    setCreditModal(customer)
    setCreditAmount('')
    setCreditOp('add')
  }

  const handleCreditSubmit = async e => {
    e.preventDefault()
    const amount = parseFloat(creditAmount)
    if (isNaN(amount) || amount <= 0) { setError('Ingresa un monto valido'); return }
    setCreditLoading(true)
    try {
      await api.patch(`/api/admin/users/${creditModal.id}/credit`, { amount, operation: creditOp })
      await fetchCustomers()
      showSuccess(`Credito actualizado para ${creditModal.name}`)
      setCreditModal(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar credito')
    } finally { setCreditLoading(false) }
  }

  // Customer orders
  const openOrdersModal = async (customer) => {
    setOrdersModal(customer)
    setSelectedOrderIds([])
    setOrdersLoading(true)
    try {
      const res = await api.get(`/api/admin/users/${customer.id}/orders`)
      setCustomerOrders(res.data)
    } catch { setCustomerOrders([]) }
    finally { setOrdersLoading(false) }
  }

  const toggleOrderSelect = (id) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAllUnpaid = () => {
    const unpaid = customerOrders.filter(o => o.payment_status !== 'pagado' && o.status !== 'cancelado').map(o => o.id)
    setSelectedOrderIds(unpaid)
  }

  const handleBulkPay = async () => {
    if (selectedOrderIds.length === 0) return
    setBulkPayLoading(true)
    try {
      await api.post('/api/admin/orders/confirm-payment', { order_ids: selectedOrderIds, payment_method: bulkPayMethod })
      showSuccess(`${selectedOrderIds.length} pedido(s) marcado(s) como pagado(s)`)
      const res = await api.get(`/api/admin/users/${ordersModal.id}/orders`)
      setCustomerOrders(res.data)
      setSelectedOrderIds([])
      await fetchCustomers()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al confirmar pagos')
    } finally { setBulkPayLoading(false) }
  }

  const unpaidTotal = customerOrders
    .filter(o => selectedOrderIds.includes(o.id))
    .reduce((sum, o) => sum + o.total, 0)

  if (loading) return <div className="loading">Cargando clientes...</div>

  return (
    <div>
      <div className="admin-header">
        <h1>Clientes</h1>
        <p>Gestion de clientes, creditos y pagos</p>
      </div>

      {error && <div className="alert alert-error" onClick={() => setError('')}>{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="table-card">
        <div className="table-header">
          <h2>Clientes ({filtered.length})</h2>
          <input type="text" className="admin-search" placeholder="Buscar por nombre, email o numero..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <table>
          <thead>
            <tr>
              <th>N. Cliente</th>
              <th>Nombre</th>
              <th>Email / Telefono</th>
              <th>Credito</th>
              <th>Deuda</th>
              <th>Pedidos</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--green)', fontSize: '1rem' }}>
                    {customerNum(c.id)}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--gray)' }}>
                    Desde {new Date(c.created_at).toLocaleDateString('es-UY')}
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: '0.88rem' }}>{c.email}</div>
                  {c.phone && <div style={{ fontSize: '0.82rem', color: 'var(--gray)' }}>{c.phone}</div>}
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: c.credit_balance > 0 ? 'var(--green)' : 'var(--gray)' }}>
                    ${Number(c.credit_balance || 0).toLocaleString('es-UY')}
                  </span>
                </td>
                <td>
                  {c.deuda_total > 0
                    ? <span style={{ fontWeight: 700, color: 'var(--danger)' }}>${Number(c.deuda_total).toLocaleString('es-UY')}</span>
                    : <span style={{ color: 'var(--gray)' }}>Sin deuda</span>}
                </td>
                <td style={{ fontWeight: 600 }}>{c.order_count}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openCreditModal(c)} title="Gestionar credito">
                      Credito
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => openOrdersModal(c)} title="Ver pedidos y marcar pagos">
                      Pedidos
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gray)', padding: '2rem' }}>
                {search ? 'No se encontraron clientes' : 'No hay clientes registrados'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Credit Modal */}
      {creditModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setCreditModal(null) }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">Gestionar Credito</h2>
              <button className="modal-close" onClick={() => setCreditModal(null)}>x</button>
            </div>
            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--light)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>Cliente: <strong>{creditModal.name}</strong> {customerNum(creditModal.id)}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem' }}>
                Saldo actual: <span style={{ color: 'var(--green)' }}>${Number(creditModal.credit_balance || 0).toLocaleString('es-UY')}</span>
              </div>
            </div>
            <form onSubmit={handleCreditSubmit}>
              <div className="form-group">
                <label className="form-label">Operacion</label>
                <select className="form-select" value={creditOp} onChange={e => setCreditOp(e.target.value)}>
                  <option value="add">Agregar credito</option>
                  <option value="subtract">Descontar credito</option>
                  <option value="set">Establecer saldo exacto</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Monto ($)</label>
                <input type="number" className="form-input" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="0" min="0" step="1" autoFocus />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreditModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={creditLoading}>
                  {creditLoading ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Orders Modal */}
      {ordersModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setOrdersModal(null) }}>
          <div className="modal" style={{ maxWidth: 750 }}>
            <div className="modal-header">
              <h2 className="modal-title">Pedidos de {ordersModal.name} {customerNum(ordersModal.id)}</h2>
              <button className="modal-close" onClick={() => setOrdersModal(null)}>x</button>
            </div>

            {ordersLoading ? <div className="loading">Cargando...</div> : (
              <>
                {customerOrders.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem' }}>
                    <div className="empty-state-icon">📋</div>
                    <h3>Sin pedidos</h3>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button className="btn btn-secondary btn-sm" onClick={selectAllUnpaid}>
                        Seleccionar todos sin pagar
                      </button>
                      {selectedOrderIds.length > 0 && (
                        <span style={{ fontSize: '0.88rem', color: 'var(--gray)' }}>
                          {selectedOrderIds.length} seleccionado(s) — Total: <strong style={{ color: 'var(--green)' }}>${unpaidTotal.toLocaleString('es-UY')}</strong>
                        </span>
                      )}
                    </div>

                    <table style={{ marginBottom: '1rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: 32 }}></th>
                          <th>Pedido</th>
                          <th>Fecha</th>
                          <th>Total</th>
                          <th>Estado pedido</th>
                          <th>Pago</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerOrders.map(o => {
                          const isPaid = o.payment_status === 'pagado'
                          const isCancelled = o.status === 'cancelado'
                          return (
                            <tr key={o.id} style={{ opacity: isCancelled ? 0.5 : 1 }}>
                              <td>
                                {!isPaid && !isCancelled && (
                                  <input type="checkbox" checked={selectedOrderIds.includes(o.id)} onChange={() => toggleOrderSelect(o.id)} />
                                )}
                              </td>
                              <td><strong>#{o.id}</strong></td>
                              <td style={{ fontSize: '0.82rem', color: 'var(--gray)' }}>{new Date(o.created_at).toLocaleDateString('es-UY')}</td>
                              <td><strong style={{ color: 'var(--green)' }}>${Number(o.total).toLocaleString('es-UY')}</strong></td>
                              <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                              <td>
                                <span className={`badge ${isPaid ? 'badge-pagado' : 'badge-pendiente'}`}>
                                  {isPaid ? `Pagado (${o.payment_method})` : o.payment_method}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {selectedOrderIds.length > 0 && (
                      <div style={{ background: 'var(--light)', padding: '1rem', borderRadius: 10 }}>
                        <label className="form-label">Marcar como pagado con:</label>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <select className="form-select" style={{ flex: 1, minWidth: 150 }} value={bulkPayMethod} onChange={e => setBulkPayMethod(e.target.value)}>
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="credito">Credito</option>
                          </select>
                          <button className="btn btn-primary" onClick={handleBulkPay} disabled={bulkPayLoading}>
                            {bulkPayLoading ? 'Procesando...' : `Confirmar pago de $${unpaidTotal.toLocaleString('es-UY')}`}
                          </button>
                        </div>
                        {bulkPayMethod === 'credito' && (
                          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--info)' }}>
                            Credito disponible: ${Number(ordersModal.credit_balance || 0).toLocaleString('es-UY')}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOrdersModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
