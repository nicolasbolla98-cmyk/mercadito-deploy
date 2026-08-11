import { useContext, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import api from '../../api/axios'

const NAV_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/pedidos', label: 'Pedidos', icon: '🛒' },
  { to: '/admin/deudas', label: 'Deudas', icon: '🤝' },
  { to: '/admin/productos', label: 'Productos', icon: '📦' },
  { to: '/admin/categorias', label: 'Categorias', icon: '🏷️' },
  { to: '/admin/clientes', label: 'Clientes', icon: '👥' },
  { to: '/admin/administradores', label: 'Administradores', icon: '🔐' },
  { to: '/admin/configuracion', label: 'Configuracion', icon: '⚙️' },
]

export default function AdminLayout() {
  const { user, logout } = useContext(AuthContext)
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleChange = e => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.newPassword !== form.confirmPassword) {
      setError('Las contraseñas nuevas no coinciden')
      return
    }
    if (form.newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      await api.put('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      setSuccess('Contraseña cambiada correctamente')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => { setShowModal(false); setSuccess('') }, 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="admin-sidebar-logo">
            Mercadito <span>Admin</span>
          </span>
          <div className="admin-sidebar-sub">Panel de administración</div>
        </div>

        <ul className="admin-nav">
          {NAV_LINKS.map(link => (
            <li key={link.to}>
              <NavLink to={link.to} end={link.end}>
                <span>{link.icon}</span>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-user">👤 {user?.name}</div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', marginBottom: '0.5rem' }}
            onClick={() => setShowModal(true)}
          >
            🔑 Cambiar contraseña
          </button>
          <button className="btn btn-danger btn-sm" style={{ width: '100%' }} onClick={handleLogout}>
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">🔑 Cambiar contraseña</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Contraseña actual</label>
                <input
                  type="password"
                  name="currentPassword"
                  className="form-input"
                  placeholder="Tu contraseña actual"
                  value={form.currentPassword}
                  onChange={handleChange}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva contraseña</label>
                <input
                  type="password"
                  name="newPassword"
                  className="form-input"
                  placeholder="Mínimo 6 caracteres"
                  value={form.newPassword}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className="form-input"
                  placeholder="Repetí la nueva contraseña"
                  value={form.confirmPassword}
                  onChange={handleChange}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
