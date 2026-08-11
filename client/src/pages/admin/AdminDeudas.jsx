import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

export default function AdminDeudas() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchDeudas = useCallback(() => {
    return api.get('/api/admin/deudas')
      .then(res => setClientes(res.data))
      .catch(() => setError('Error al cargar deudas'))
  }, [])

  useEffect(() => {
    fetchDeudas().finally(() => setLoading(false))
  }, [fetchDeudas])

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleSaldar = async (orderId) => {
    try {
      await api.patch(`/api/admin/orders/${orderId}/saldar`)
      await fetchDeudas()
      showSuccess('Deuda saldada correctamente')
    } catch {
      setError('Error al saldar deuda')
    }
  }

  const totalGeneral = clientes.reduce((sum, c) => sum + c.total_deuda, 0)

  if (loading) return <div className="loading">Cargando deudas...</div>

  return (
    <div>
      <div className="admin-header">
        <h1>Lista de Deudas</h1>
        <p>Clientes con pedidos fiados aprobados pendientes de cobro</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {clientes.length === 0 ? (
        <div className="empty-state" style={{ padding: '3rem' }}>
          <div className="empty-state-icon">🤝</div>
          <h3>Sin deudas pendientes</h3>
          <p>No hay clientes con fiados aprobados sin saldar.</p>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--green)', color: 'white', borderRadius: 12, padding: '1.25rem 1.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total general de deudas</span>
            <span style={{ fontWeight: 800, fontSize: '1.5rem' }}>${totalGeneral.toLocaleString('es-UY')}</span>
          </div>

          {clientes.map((cliente, i) => (
            <div key={i} className="table-card" style={{ marginBottom: '1.5rem' }}>
              <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{ marginBottom: '0.25rem' }}>{cliente.name}</h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>
                    {cliente.email}
                    {cliente.phone && ` · ${cliente.phone}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>{cliente.orders.length} pedido{cliente.orders.length !== 1 ? 's' : ''}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--danger)' }}>
                    ${cliente.total_deuda.toLocaleString('es-UY')}
                  </div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>#Pedido</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cliente.orders.map(order => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 700 }}>#{order.id}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>
                        {new Date(order.created_at).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td>
                        <strong style={{ color: 'var(--danger)' }}>${Number(order.total).toLocaleString('es-UY')}</strong>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaldar(order.id)}
                        >
                          Saldar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
