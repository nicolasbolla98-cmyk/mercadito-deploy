import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/admin/stats')
      .then(res => setStats(res.data))
      .catch(err => setError(err.response?.data?.error || 'Error al cargar estadísticas'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Cargando dashboard...</div>
  if (error) return <div className="alert alert-error">{error}</div>

  return (
    <div>
      <div className="admin-header">
        <h1>Dashboard</h1>
        <p>Resumen general de Mercadito la U</p>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card-icon">🛒</div>
          <div className="stat-card-value">{stats.totalOrders}</div>
          <div className="stat-card-label">Total Pedidos</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">💰</div>
          <div className="stat-card-value">
            ${Number(stats.totalRevenue || 0).toLocaleString('es-UY')}
          </div>
          <div className="stat-card-label">Ingresos Totales</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">👥</div>
          <div className="stat-card-value">{stats.totalCustomers}</div>
          <div className="stat-card-label">Clientes</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📦</div>
          <div className="stat-card-value">{stats.totalProducts}</div>
          <div className="stat-card-label">Productos Activos</div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <h2>Últimos Pedidos</h2>
          <Link to="/admin/pedidos" className="btn btn-primary btn-sm">Ver todos</Link>
        </div>
        {stats.recentOrders?.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-state-icon">📋</div>
            <h3>Sin pedidos aún</h3>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders?.map(order => (
                <tr key={order.id}>
                  <td>
                    <strong>#{order.id}</strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{order.customer_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>{order.customer_email}</div>
                  </td>
                  <td style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>
                    {new Date(order.created_at).toLocaleDateString('es-UY')}
                  </td>
                  <td>
                    <strong style={{ color: 'var(--green)' }}>
                      ${Number(order.total).toLocaleString('es-UY')}
                    </strong>
                  </td>
                  <td>
                    <span className={`badge badge-${order.status}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
