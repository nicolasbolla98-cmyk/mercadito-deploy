import { createContext, useState, useEffect, useContext } from 'react'

export const CartContext = createContext(null)

function itemKey(productId, mode) {
  return `${productId}_${mode || 'kg'}`
}

function effectivePrice(product, mode) {
  return mode === 'cajon' && product.cajon_price ? product.cajon_price : product.price
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem('cart')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items))
  }, [items])

  // mode: 'kg' | 'cajon' | undefined (for non-kg products)
  const addItem = (product, quantity = 1, mode) => {
    const key = itemKey(product.id, mode)
    setItems(prev => {
      const existing = prev.find(i => i.key === key)
      if (existing) {
        return prev.map(i => i.key === key ? { ...i, quantity: i.quantity + quantity } : i)
      }
      return [...prev, { key, product, quantity, mode: mode || null }]
    })
  }

  const removeItem = (key) => setItems(prev => prev.filter(i => i.key !== key))

  const updateQuantity = (key, quantity) => {
    if (quantity <= 0) { removeItem(key); return }
    setItems(prev => prev.map(i => i.key === key ? { ...i, quantity } : i))
  }

  const clearCart = () => setItems([])

  const total = items.reduce((sum, i) => sum + effectivePrice(i.product, i.mode) * i.quantity, 0)
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount, effectivePrice }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
