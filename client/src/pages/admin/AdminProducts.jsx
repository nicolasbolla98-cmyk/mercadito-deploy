import { useState, useEffect, useCallback } from 'react'
import api from '../../api/axios'

const UNITS = [
  { value: 'kg', label: 'Kilogramo (kg) — selector 0.1 a 10 kg' },
  { value: 'unidad', label: 'Unidad — ej: 1, 2, 3 unidades' },
  { value: 'caja', label: 'Caja — ej: 1, 2, 3 cajas' },
  { value: 'litro', label: 'Litro (L)' },
  { value: 'docena', label: 'Docena' },
]

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  cajon_price: '',
  stock: '',
  unit: 'kg',
  category_id: '',
  active: true,
}

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Inline editing
  const [inlineEdit, setInlineEdit] = useState({}) // { productId: { field: 'price'|'stock', value } }

  const fetchProducts = useCallback(() => {
    return api.get('/api/products?all=true')
      .then(res => setProducts(res.data))
      .catch(err => setError(err.response?.data?.error || 'Error al cargar productos'))
  }, [])

  useEffect(() => {
    Promise.all([
      fetchProducts(),
      api.get('/api/products/categories').then(res => setCategories(res.data)),
    ]).finally(() => setLoading(false))
  }, [fetchProducts])

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const openCreateModal = () => {
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      cajon_price: product.cajon_price ?? '',
      stock: product.stock,
      unit: product.unit,
      category_id: product.category_id || '',
      active: product.active === 1,
    })
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingProduct(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!form.name || form.price === '' || form.stock === '') {
      setFormError('Nombre, precio y stock son requeridos')
      return
    }
    if (isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
      setFormError('El precio debe ser un número válido')
      return
    }
    if (isNaN(parseInt(form.stock)) || parseInt(form.stock) < 0) {
      setFormError('El stock debe ser un número válido')
      return
    }

    setFormLoading(true)
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        cajon_price: form.cajon_price !== '' ? parseFloat(form.cajon_price) : null,
        stock: parseInt(form.stock),
        category_id: form.category_id || null,
      }

      if (editingProduct) {
        await api.put(`/api/products/${editingProduct.id}`, payload)
        showSuccess('Producto actualizado correctamente')
      } else {
        await api.post('/api/products', payload)
        showSuccess('Producto creado correctamente')
      }

      await fetchProducts()
      closeModal()
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar producto')
    } finally {
      setFormLoading(false)
    }
  }

  const handleToggleActive = async (product) => {
    try {
      await api.put(`/api/products/${product.id}`, {
        ...product,
        active: product.active === 1 ? false : true,
        category_id: product.category_id || null,
      })
      await fetchProducts()
      showSuccess('Estado actualizado')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar estado')
    }
  }

  const handleDelete = async (product) => {
    if (!window.confirm(`¿Desactivar el producto "${product.name}"?`)) return
    try {
      await api.delete(`/api/products/${product.id}`)
      await fetchProducts()
      showSuccess('Producto desactivado')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar producto')
    }
  }

  // Inline editing
  const startInlineEdit = (productId, field, currentValue) => {
    setInlineEdit({ productId, field, value: String(currentValue) })
  }

  const cancelInlineEdit = () => setInlineEdit({})

  const saveInlineEdit = async () => {
    const { productId, field, value } = inlineEdit
    const product = products.find(p => p.id === productId)
    if (!product) return

    const parsed = field === 'price' ? parseFloat(value) : parseInt(value)
    if (isNaN(parsed) || parsed < 0) {
      cancelInlineEdit()
      return
    }

    try {
      await api.put(`/api/products/${productId}`, {
        ...product,
        [field]: parsed,
        active: product.active === 1,
        category_id: product.category_id || null,
      })
      await fetchProducts()
      showSuccess('Guardado')
    } catch (err) {
      setError('Error al guardar')
    }
    cancelInlineEdit()
  }

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') saveInlineEdit()
    if (e.key === 'Escape') cancelInlineEdit()
  }

  if (loading) return <div className="loading">Cargando productos...</div>

  return (
    <div>
      <div className="admin-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Productos</h1>
            <p>Gestioná el catálogo de productos</p>
          </div>
          <button className="btn btn-primary" onClick={openCreateModal}>
            + Nuevo Producto
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="table-card">
        <div className="table-header">
          <h2>Todos los Productos ({products.length})</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Precio/kg</th>
              <th>Precio cajón</th>
              <th>Stock</th>
              <th>Unidad</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>{product.id}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{product.name}</div>
                  {product.description && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray)' }}>{product.description}</div>
                  )}
                </td>
                <td>
                  {product.category_icon && <span>{product.category_icon} </span>}
                  {product.category_name || <span style={{ color: 'var(--gray)' }}>—</span>}
                </td>
                <td>
                  {inlineEdit.productId === product.id && inlineEdit.field === 'price' ? (
                    <div className="inline-edit">
                      <input
                        type="number"
                        value={inlineEdit.value}
                        onChange={e => setInlineEdit(prev => ({ ...prev, value: e.target.value }))}
                        onBlur={saveInlineEdit}
                        onKeyDown={handleInlineKeyDown}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span
                      style={{ cursor: 'pointer', color: 'var(--green)', fontWeight: 700 }}
                      onClick={() => startInlineEdit(product.id, 'price', product.price)}
                      title="Click para editar"
                    >
                      ${Number(product.price).toLocaleString('es-UY')} ✏️
                    </span>
                  )}
                </td>
                <td style={{ color: product.cajon_price ? 'var(--green)' : 'var(--gray)' }}>
                  {product.cajon_price ? `$${Number(product.cajon_price).toLocaleString('es-UY')}` : '—'}
                </td>
                <td>
                  {inlineEdit.productId === product.id && inlineEdit.field === 'stock' ? (
                    <div className="inline-edit">
                      <input
                        type="number"
                        value={inlineEdit.value}
                        onChange={e => setInlineEdit(prev => ({ ...prev, value: e.target.value }))}
                        onBlur={saveInlineEdit}
                        onKeyDown={handleInlineKeyDown}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span
                      style={{ cursor: 'pointer' }}
                      onClick={() => startInlineEdit(product.id, 'stock', product.stock)}
                      title="Click para editar"
                    >
                      {product.stock} ✏️
                    </span>
                  )}
                </td>
                <td style={{ color: 'var(--gray)' }}>{product.unit}</td>
                <td>
                  <span
                    className={`badge ${product.active ? 'badge-activo' : 'badge-inactivo'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleToggleActive(product)}
                    title="Click para cambiar estado"
                  >
                    {product.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditModal(product)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(product)}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--gray)', padding: '2rem' }}>
                  No hay productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {formError && <div className="alert alert-error">{formError}</div>}

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="Nombre del producto"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  name="description"
                  className="form-input"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Descripción opcional"
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Precio por kg *</label>
                  <input
                    type="number"
                    name="price"
                    className="form-input"
                    value={form.price}
                    onChange={handleFormChange}
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio por cajón <span style={{ color: 'var(--gray)', fontWeight: 400 }}>(opcional)</span></label>
                  <input
                    type="number"
                    name="cajon_price"
                    className="form-input"
                    value={form.cajon_price}
                    onChange={handleFormChange}
                    placeholder="Dejar vacío si no aplica"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Stock *</label>
                  <input
                    type="number"
                    name="stock"
                    className="form-input"
                    value={form.stock}
                    onChange={handleFormChange}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unidad</label>
                  <select
                    name="unit"
                    className="form-select"
                    value={form.unit}
                    onChange={handleFormChange}
                  >
                    {UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select
                    name="category_id"
                    className="form-select"
                    value={form.category_id}
                    onChange={handleFormChange}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <div className="form-checkbox-group">
                  <input
                    type="checkbox"
                    id="active"
                    name="active"
                    className="form-checkbox"
                    checked={form.active}
                    onChange={handleFormChange}
                  />
                  <label htmlFor="active" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                    Producto activo (visible en el catálogo)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
