import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { CartContext } from '../context/CartContext'

const CATEGORY_EMOJIS = {
  frutas: '🍎', verduras: '🥦', bebidas: '🥤',
  alimentos: '🥫', mascotas: '🐾', lena: '🪵', limpieza: '🧹'
}

function getProductEmoji(product) {
  return product.category_slug && CATEGORY_EMOJIS[product.category_slug]
    ? CATEGORY_EMOJIS[product.category_slug]
    : '📦'
}

export default function Cart() {
  const { items, removeItem, updateQuantity, total, clearCart, effectivePrice } = useContext(CartContext)

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div className="empty-state-icon">🛒</div>
          <h3>Tu carrito está vacío</h3>
          <p>Agregá productos desde el catálogo para comenzar tu pedido.</p>
          <Link to="/catalogo" className="btn btn-primary btn-lg" style={{ marginTop: '1rem' }}>
            Ver Catálogo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>🛒 Mi Carrito</h1>
        <p>{items.length} {items.length === 1 ? 'producto' : 'productos'} en tu carrito</p>
      </div>

      <div className="cart-page">
        <div className="cart-grid">
          {/* Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Productos</h2>
              <button className="btn btn-danger btn-sm" onClick={clearCart}>
                🗑️ Vaciar carrito
              </button>
            </div>

            {items.map((item) => {
              const { key, product, quantity, mode } = item
              const price = effectivePrice(product, mode)
              const isCajon = mode === 'cajon'
              const unitLabel = isCajon ? 'cajón' : product.unit

              return (
                <div key={key} className="cart-item">
                  <div className="cart-item-image">{getProductEmoji(product)}</div>
                  <div className="cart-item-info">
                    <div className="cart-item-name">
                      {product.name}
                      {isCajon && <span style={{ fontSize: '0.78rem', color: 'var(--green)', marginLeft: '0.4rem', fontWeight: 600 }}>por cajón</span>}
                    </div>
                    <div className="cart-item-price">
                      ${price.toLocaleString('es-UY')} / {unitLabel}
                    </div>
                    <div className="quantity-controls">
                      <button
                        className="qty-btn"
                        onClick={() => {
                          const step = !isCajon && product.unit === 'kg' ? 0.5 : 1
                          updateQuantity(key, parseFloat((quantity - step).toFixed(1)))
                        }}
                      >
                        −
                      </button>
                      <span className="qty-display">
                        {!isCajon && product.unit === 'kg'
                          ? `${quantity} kg`
                          : `${quantity} ${unitLabel}`}
                      </span>
                      <button
                        className="qty-btn"
                        onClick={() => {
                          const step = !isCajon && product.unit === 'kg' ? 0.5 : 1
                          updateQuantity(key, parseFloat((quantity + step).toFixed(1)))
                        }}
                      >
                        +
                      </button>
                    </div>
                    <div className="cart-item-subtotal">
                      Subtotal: ${(price * quantity).toLocaleString('es-UY')}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => removeItem(key)}
                    style={{ marginLeft: 'auto', alignSelf: 'flex-start' }}
                  >
                    🗑️
                  </button>
                </div>
              )
            })}

            <div style={{ marginTop: '1rem' }}>
              <Link to="/catalogo" className="btn btn-secondary">
                ← Seguir comprando
              </Link>
            </div>
          </div>

          {/* Summary */}
          <div className="cart-summary">
            <h3>Resumen del pedido</h3>

            {items.map((item) => {
              const { key, product, quantity, mode } = item
              const price = effectivePrice(product, mode)
              const isCajon = mode === 'cajon'
              const unitLabel = isCajon ? 'cajón' : product.unit
              return (
                <div key={key} className="summary-row">
                  <span style={{ fontSize: '0.88rem' }}>
                    {product.name}{isCajon ? ' (cajón)' : ''} × {!isCajon && product.unit === 'kg' ? `${quantity} kg` : `${quantity} ${unitLabel}`}
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                    ${(price * quantity).toLocaleString('es-UY')}
                  </span>
                </div>
              )
            })}

            <div className="summary-total">
              <span>Total</span>
              <span>${total.toLocaleString('es-UY')}</span>
            </div>

            <Link
              to="/checkout"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '1.25rem' }}
            >
              Confirmar Pedido →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
