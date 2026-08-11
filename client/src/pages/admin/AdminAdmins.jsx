import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

const PERMISSION_SETS = [
  { label: 'Super Administrador (acceso total)', value: 'all' },
  { label: 'Admin de Pedidos (pedidos y clientes)', value: JSON.stringify(['orders', 'customers']) },
  { label: 'Admin de Productos (productos y categorias)', value: JSON.stringify(['products', 'categories']) },
]

const EMPTY_FORM = { name: '', email: '', phone: '', password: '', permissions: 'all' }

export default function AdminAdmins() {
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const fetchAdmins = useCallback(() =>
    api.get('/api/admin/admins').then(res => setAdmins(res.data)).catch(() => {}), [])

  useEffect(() => { fetchAdmins().finally(() => setLoading(false)) }, [fetchAdmins])

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const openCreate = () => { setEditingAdmin(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true) }
  const openEdit = (admin) => {
    setEditingAdmin(admin)
    const perms = admin.permissions === null ? 'all' : admin.permissions
    setForm({ name: admin.name, email: admin.email, phone: admin.phone || '', password: '', permissions: perms })
    setFormError(''); setModalOpen(true)
  }
  const closeModal = () => { setModalOpen(false); setEditingAdmin(null); setForm(EMPTY_FORM) }

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.name || !form.email) { setFormError('Nombre y email son requeridos'); return }
    if (!editingAdmin && !form.password) { setFormError('La contrasena es requerida'); return }
    if (form.password && form.password.length < 6) { setFormError('La contrasena debe tener al menos 6 caracteres'); return }

    const payload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      permissions: form.permissions === 'all' ? 'all' : JSON.parse(form.permissions),
    }
    if (form.password) payload.password = form.password

    setFormLoading(true)
    try {
      if (editingAdmin) {
        await api.put(`/api/admin/admins/${editingAdmin.id}`, payload)
        showSuccess('Administrador actualizado')
      } else {
        await api.post('/api/admin/admins', { ...payload, password: form.password })
        showSuccess('Administrador creado')
      }
      await fetchAdmins()
      closeModal()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar')
    } finally { setFormLoading(false) }
  }

  const handleDelete = async (admin) => {
    if (!window.confirm(`Eliminar al administrador "${admin.name}"? Esta accion no se puede deshacer.`)) return
    try {
      await api.delete(`/api/admin/admins/${admin.id}`)
      await fetchAdmins()
      showSuccess('Administrador eliminado')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar')
    }
  }

  const getPermLabel = (perms) => {
    if (perms === null || perms === 'all') return 'Super Admin'
    try {
      const arr = JSON.parse(perms)
      if (arr.includes('all')) return 'Super Admin'
      return arr.join(', ')
    } catch { return perms }
  }

  if (loading) return <div className="loading">Cargando administradores...</div>

  return (
    <div>
      <div className="admin-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Administradores</h1>
            <p>Gestionas los usuarios con acceso al panel</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Nuevo Admin</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
        Los administradores con permiso "Super Admin" tienen acceso total. Los demas solo pueden acceder a las secciones indicadas.
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Permisos</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.id}>
                <td style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>{admin.id}</td>
                <td style={{ fontWeight: 600 }}>{admin.name}</td>
                <td>{admin.email}</td>
                <td>
                  <span className={`badge ${admin.permissions === null ? 'badge-activo' : 'badge-confirmado'}`}>
                    {getPermLabel(admin.permissions)}
                  </span>
                </td>
                <td style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>
                  {new Date(admin.created_at).toLocaleDateString('es-UY')}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(admin)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(admin)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray)', padding: '2rem' }}>No hay administradores</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingAdmin ? 'Editar Administrador' : 'Nuevo Administrador'}</h2>
              <button className="modal-close" onClick={closeModal}>x</button>
            </div>
            {formError && <div className="alert alert-error">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input type="text" name="name" className="form-input" value={form.name} onChange={handleChange} placeholder="Nombre completo" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" name="email" className="form-input" value={form.email} onChange={handleChange} placeholder="admin@ejemplo.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Telefono</label>
                <input type="tel" name="phone" className="form-input" value={form.phone} onChange={handleChange} placeholder="+598 94 000 000" />
              </div>
              <div className="form-group">
                <label className="form-label">{editingAdmin ? 'Nueva contrasena (dejar vacio para no cambiar)' : 'Contrasena *'}</label>
                <input type="password" name="password" className="form-input" value={form.password} onChange={handleChange} placeholder="Minimo 6 caracteres" />
              </div>
              <div className="form-group">
                <label className="form-label">Nivel de acceso</label>
                <select name="permissions" className="form-select" value={form.permissions} onChange={handleChange}>
                  {PERMISSION_SETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : editingAdmin ? 'Actualizar' : 'Crear Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
