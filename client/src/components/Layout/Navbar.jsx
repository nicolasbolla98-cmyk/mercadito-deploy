import { useState, useContext, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import { CartContext } from '../../context/CartContext'

export default function Navbar() {
  const { isAuthenticated, isAdmin, user, logout } = useContext(AuthContext)
  const { itemCount } = useContext(CartContext)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    setDropdownOpen(false)
    setMobileOpen(false)
    navigate('/')
  }

  const closeMobile = () => setMobileOpen(false)

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo" onClick={closeMobile}>
        <img src="/logo.jpeg" alt="Mercadito la U" />
        <span>Mercadito la U</span>
      </Link>

      <ul className={`navbar-links ${mobileOpen ? 'mobile-open' : ''}`}>
        <li><NavLink to="/" end onClick={closeMobile}>Inicio</NavLink></li>
        <li><NavLink to="/catalogo" onClick={closeMobile}>Catálogo</NavLink></li>
        {isAuthenticated && isAdmin && (
          <li><NavLink to="/admin" onClick={closeMobile}>Panel Admin</NavLink></li>
        )}
        {/* Auth links inside mobile menu */}
        {!isAuthenticated && (
          <>
            <li className="mobile-only"><NavLink to="/login" onClick={closeMobile}>Ingresar</NavLink></li>
            <li className="mobile-only"><NavLink to="/registro" onClick={closeMobile}>Registrarse</NavLink></li>
          </>
        )}
        {isAuthenticated && (
          <>
            {!isAdmin && <li className="mobile-only"><NavLink to="/mis-pedidos" onClick={closeMobile}>Mis Pedidos</NavLink></li>}
            <li className="mobile-only">
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', fontFamily: 'Poppins', fontWeight: 500, fontSize: '1rem', cursor: 'pointer', padding: '1rem', width: '100%', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                Cerrar sesión
              </button>
            </li>
          </>
        )}
      </ul>

      <div className="navbar-actions">
        <Link to="/carrito" className="cart-btn" title="Carrito">
          🛒
          {itemCount > 0 && <span className="cart-badge">{itemCount > 99 ? '99+' : itemCount}</span>}
        </Link>

        {/* Desktop auth buttons */}
        {!isAuthenticated ? (
          <div className="desktop-only" style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to="/login" className="btn btn-outline btn-sm">Ingresar</Link>
            <Link to="/registro" className="btn btn-primary btn-sm">Registrarse</Link>
          </div>
        ) : (
          <div className="user-menu desktop-only" ref={dropdownRef}>
            <button
              className="user-menu-trigger"
              onClick={() => setDropdownOpen(prev => !prev)}
            >
              <span>👤</span>
              <span>{user?.name?.split(' ')[0]}</span>
              <span>{dropdownOpen ? '▲' : '▼'}</span>
            </button>
            {dropdownOpen && (
              <div className="user-dropdown">
                {!isAdmin && (
                  <Link to="/mis-pedidos" onClick={() => setDropdownOpen(false)}>
                    <span>📦</span> Mis Pedidos
                  </Link>
                )}
                {isAdmin && (
                  <Link to="/admin" onClick={() => setDropdownOpen(false)}>
                    <span>⚙️</span> Panel Admin
                  </Link>
                )}
                <div className="user-dropdown-divider" />
                <button onClick={handleLogout}>
                  <span>🚪</span> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}

        <button
          className="hamburger"
          onClick={() => setMobileOpen(prev => !prev)}
          aria-label="Menú"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>
    </nav>
  )
}
