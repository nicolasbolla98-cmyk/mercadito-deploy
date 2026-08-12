import { useState, useEffect, useContext } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { CartContext } from '../context/CartContext'

const CATEGORY_EMOJIS = {
  frutas: '🍎', verduras: '🥦', bebidas: '🥤',
  alimentos: '🥫', mascotas: '🐾', lena: '🪵', limpieza: '🧹'
}

const KG_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

function getCategoryEmoji(product) {
  return CATEGORY_EMOJIS[product.category_slug] || '📦'
}

function SkeletonCard() {
  return (
    <div className="product-card">
      <div className="skeleton" style={{ height: 180 }} />
      <div className="product-info">
        <div className="skeleton skeleton-text" style={{ marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: '40%' }} />
      </div>
    </div>
  )
}

function KgSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 500 }}>Cantidad:</span>
      <select
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="form-select"
        style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: 8, border: '2px solid #e5e7eb', fontFamily: 'Poppins, sans-serif' }}
      >
        {KG_OPTIONS.map(kg => (
          <option key={kg} value={kg}>{kg} kg</option>
        ))}
      </select>
    </div>
  )
}

function UnitSelector({ value, onChange, unit }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--gray)', fontWeight: 500 }}>Cantidad:</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={e => {
          const v = parseInt(e.target.value)
          if (!isNaN(v) && v >= 1) onChange(v)
        }}
        style={{ width: 80, padding: '0.4rem 0.6rem', fontSize: '0.9rem', fontWeight: 600, borderRadius: 8, border: '2px solid #e5e7eb', fontFamily: 'Poppins, sans-serif', textAlign: 'center' }}
      />
      <span style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>{unit}</span>
    </div>
  )
}

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const { addItem } = useContext(CartContext)
  const [addedKey, setAddedKey] = useState(null)
  const [quantities, setQuantities] = useState({}) // { productId: number }
  const [modes, setModes] = useState({}) // { productId: 'kg' | 'cajon' }

  const selectedCategory = searchParams.get('category') || ''

  useEffect(() => {
    api.get('/api/products/categories').then(res => setCategories(res.data)).catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = {}
    if (selectedCategory) params.category = selectedCategory
    if (search) params.search = search
    const timeout = setTimeout(() => {
      api.get('/api/products', { params })
        .then(res => {
          setProducts(res.data)
          const initQty = {}
          const initMode = {}
          res.data.forEach(p => {
            initQty[p.id] = p.unit === 'kg' ? 1 : 1
            initMode[p.id] = 'kg'
          })
          setQuantities(initQty)
          setModes(initMode)
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }, search ? 400 : 0)
    return () => clearTimeout(timeout)
  }, [selectedCategory, search])

  const setQty = (productId, qty) => setQuantities(prev => ({ ...prev, [productId]: qty }))
  const setMode = (productId, mode) => {
    setModes(prev => ({ ...prev, [productId]: mode }))
    setQuantities(prev => ({ ...prev, [productId]: mode === 'cajon' ? 1 : 1 }))
  }

  const handleAddToCart = (product) => {
    const currentMode = modes[product.id] || (product.unit === 'kg' ? 'kg' : 'unit')
    const mode = currentMode === 'cajon' ? 'cajon' : undefined
    const qty = quantities[product.id] ?? 1
    addItem(product, qty, mode)
    const key = `${product.id}_${currentMode}`
    setAddedKey(key)
    setTimeout(() => setAddedKey(null), 1500)
  }

  const getStockInfo = (product) => {
    if (product.stock === 0) return { text: 'Sin stock', cls: 'stock-out' }
    if (product.unit === 'kg' && product.stock < 5) return { text: `Solo ~${product.stock} kg`, cls: 'stock-low' }
    if (product.unit !== 'kg' && product.stock < 10) return { text: `Solo ${product.stock} disponibles`, cls: 'stock-low' }
    return { text: product.unit === 'kg' ? 'Disponible' : `${product.stock} disponibles`, cls: '' }
  }

  const handleCategoryFilter = (slug) => setSearchParams(slug === selectedCategory ? {} : { category: slug })

  return (
    <div>
      <div className="page-header">
        <h1>Catalogo de Productos</h1>
        <p>Encontra todo lo que necesitas para tu hogar</p>
      </div>

      <div className="section">
        <div className="container">
          <div className="filters-bar">
            <input
              type="text"
              className="search-input"
              placeholder="Buscar productos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button className={`filter-chip ${selectedCategory === '' ? 'active' : ''}`} onClick={() => { setSearchParams({}); setSearch('') }}>
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`filter-chip ${selectedCategory === cat.slug ? 'active' : ''}`}
                onClick={() => handleCategoryFilter(cat.slug)}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="products-grid">{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3>No encontramos productos</h3>
              <p>Intenta con otra busqueda o categoria</p>
            </div>
          ) : (
            <div className="products-grid">
              {products.map(product => {
                const { text: stockText, cls: stockCls } = getStockInfo(product)
                const isKg = product.unit === 'kg'
                const hasCajon = product.cajon_price
                const mode = modes[product.id] || (isKg ? 'kg' : 'unit')
                const qty = quantities[product.id] ?? 1
                const displayPrice = mode === 'cajon' ? product.cajon_price : product.price
                const addedThisKey = addedKey === `${product.id}_${mode}`

                return (
                  <div key={product.id} className="product-card">
                    <div className="product-image">
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : getCategoryEmoji(product)}
                    </div>
                    <div className="product-info">
                      <div className="product-name">{product.name}</div>

                      {/* Precios visibles */}
                      {hasCajon ? (
                        <div style={{ marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.82rem', background: '#f0fdf4', color: 'var(--green-dark)', borderRadius: 6, padding: '0.2rem 0.5rem', fontWeight: 700 }}>
                              ${Number(product.price).toLocaleString('es-UY')} / {product.unit}
                            </span>
                            <span style={{ fontSize: '0.82rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, padding: '0.2rem 0.5rem', fontWeight: 700 }}>
                              ${Number(product.cajon_price).toLocaleString('es-UY')} / cajón
                            </span>
                          </div>
                          {/* Toggle kg / cajón */}
                          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                            <button type="button" onClick={() => setMode(product.id, isKg ? 'kg' : 'unit')} style={{ flex: 1, padding: '0.3rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, border: `2px solid ${mode !== 'cajon' ? 'var(--green)' : '#e5e7eb'}`, background: mode !== 'cajon' ? 'var(--green)' : 'white', color: mode !== 'cajon' ? 'white' : 'var(--dark)', cursor: 'pointer' }}>
                              Por {product.unit}
                            </button>
                            <button type="button" onClick={() => setMode(product.id, 'cajon')} style={{ flex: 1, padding: '0.3rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, border: `2px solid ${mode === 'cajon' ? 'var(--green)' : '#e5e7eb'}`, background: mode === 'cajon' ? 'var(--green)' : 'white', color: mode === 'cajon' ? 'white' : 'var(--dark)', cursor: 'pointer' }}>
                              Por cajón
                            </button>
                          </div>
                          <div className="product-price" style={{ fontSize: '1.1rem' }}>
                            ${displayPrice?.toLocaleString('es-UY')}
                            <span className="product-unit"> / {mode === 'cajon' ? 'cajón' : product.unit}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="product-price">
                          ${displayPrice?.toLocaleString('es-UY')}
                          <span className="product-unit"> / {product.unit}</span>
                        </div>
                      )}

                      {product.description && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--gray)', margin: '0.35rem 0 0.5rem' }}>{product.description}</div>
                      )}

                      <div className={`product-stock ${stockCls}`} style={{ marginBottom: '0.75rem' }}>{stockText}</div>

                      {product.stock > 0 && (
                        mode === 'cajon'
                          ? <UnitSelector value={qty} onChange={v => setQty(product.id, v)} unit="cajon" />
                          : isKg
                            ? <KgSelector value={qty} onChange={v => setQty(product.id, v)} />
                            : <UnitSelector value={qty} onChange={v => setQty(product.id, v)} unit={product.unit} />
                      )}

                      {product.stock > 0 && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--green)', fontWeight: 600, marginBottom: '0.75rem' }}>
                          Total: ${((displayPrice || 0) * qty).toLocaleString('es-UY')}
                        </div>
                      )}

                      <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock === 0}
                      >
                        {addedThisKey
                          ? 'Agregado'
                          : product.stock === 0
                          ? 'Sin stock'
                          : mode === 'cajon'
                            ? `Agregar ${qty} cajon${qty > 1 ? 'es' : ''}`
                            : isKg
                              ? `Agregar ${qty} kg`
                              : `Agregar ${qty} ${product.unit}`}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
