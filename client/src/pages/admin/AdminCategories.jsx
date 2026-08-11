import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

const EMPTY_FORM = { name: '', slug: '', icon: '', active: true }

function toSlug(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const fetchCategories = useCallback(() =>
    api.get('/api/admin/categories').then(res => setCategories(res.data)).catch(() => {}), [])

  useEffect(() => { fetchCategories().finally(() => setLoading(false)) }, [fetchCategories])

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const openCreate = () => { setEditingCat(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true) }
  const openEdit = (cat) => {
    setEditingCat(cat)
    setForm({ name: cat.name, slug: cat.slug, icon: cat.icon || '', active: cat.active === 1 })
    setFormError(''); setModalOpen(true)
  }
  const closeModal = () => { setModalOpen(false); setEditingCat(null); setForm(EMPTY_FORM) }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value }
      if (name === 'name' && !editingCat) updated.slug = toSlug(value)
      return updated
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.name || !form.slug) { setFormError('Nombre y slug son requeridos'); return }
    setFormLoading(true)
    try {
      if (editingCat) {
        await api.put(`/api/admin/categories/${editingCat.id}`, form)
        showSuccess('Categoria actualizada')
      } else {
        await api.post('/api/admin/categories', form)
        showSuccess('Categoria creada')
      }
      await fetchCategories()
      closeModal()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar')
    } finally { setFormLoading(false) }
  }

  const handleDelete = async (cat) => {
    if (!window.confirm(`Eliminar la categoria "${cat.name}"?`)) return
    try {
      await api.delete(`/api/admin/categories/${cat.id}`)
      await fetchCategories()
      showSuccess('Categoria eliminada')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar')
    }
  }

  if (loading) return <div className="loading">Cargando categorias...</div>

  return (
    <div>
      <div className="admin-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Categorias</h1>
            <p>Gestionas las categorias del catalogo</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Nueva Categoria</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Icono</th>
              <th>Nombre</th>
              <th>Slug</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <tr key={cat.id}>
                <td style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>{cat.id}</td>
                <td style={{ fontSize: '1.5rem' }}>{cat.icon}</td>
                <td style={{ fontWeight: 600 }}>{cat.name}</td>
                <td style={{ color: 'var(--gray)', fontFamily: 'monospace' }}>{cat.slug}</td>
                <td>
                  <span className={`badge ${cat.active ? 'badge-activo' : 'badge-inactivo'}`}>
                    {cat.active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cat)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cat)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray)', padding: '2rem' }}>No hay categorias</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCat ? 'Editar Categoria' : 'Nueva Categoria'}</h2>
              <button className="modal-close" onClick={closeModal}>x</button>
            </div>
            {formError && <div className="alert alert-error">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input type="text" name="name" className="form-input" value={form.name} onChange={handleChange} placeholder="Ej: Frutas" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Slug * <span style={{ color: 'var(--gray)', fontSize: '0.8rem' }}>(identificador URL)</span></label>
                <input type="text" name="slug" className="form-input" value={form.slug} onChange={handleChange} placeholder="Ej: frutas" />
              </div>
              <div className="form-group">
                <label className="form-label">Icono (emoji)</label>
                <input type="text" name="icon" className="form-input" value={form.icon} onChange={handleChange} placeholder="🍎" />
              </div>
              <div className="form-group">
                <div className="form-checkbox-group">
                  <input type="checkbox" id="active" name="active" className="form-checkbox" checked={form.active} onChange={handleChange} />
                  <label htmlFor="active" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Categoria activa</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : editingCat ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
