import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

const ICON_MAP = {
  frutas: '🍎', verduras: '🥦', bebidas: '🥤',
  alimentos: '🥫', mascotas: '🐾', lena: '🪵', limpieza: '🧹'
}

export default function Home() {
  const [categories, setCategories] = useState([])
  const [settings, setSettings] = useState({})
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/api/products/categories').then(res => setCategories(res.data)).catch(() => {})
    api.get('/api/settings').then(res => setSettings(res.data)).catch(() => {})
  }, [])

  const whatsapp = settings.whatsapp || '59894022121'
  const address = settings.address || 'Ruta Interbalnearia km 36.500, Empalme Olmos'
  const hours = settings.hours || 'Lun-Sab 8:00-20:00 | Dom 8:00-14:00'

  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <h1>
            Bienvenido a <br />
            <span>Mercadito la U</span>
          </h1>
          <p>
            Frutas y verduras frescas, y todo lo que necesitas para tu hogar.
            Pedis online y te lo llevamos a domicilio.
          </p>
          <div className="hero-btns">
            <Link to="/catalogo" className="btn btn-primary btn-lg">
              Ver Productos
            </Link>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline btn-lg"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Nuestras Categorias</h2>
          <p className="section-subtitle">Encontra todo lo que necesitas</p>
          <div className="categories-grid">
            {categories.map(cat => (
              <button
                key={cat.id}
                className="category-card"
                onClick={() => navigate(`/catalogo?category=${cat.slug}`)}
              >
                <div className="category-icon">{ICON_MAP[cat.slug] || cat.icon || '📦'}</div>
                <div className="category-name">{cat.name}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="benefits-section">
        <div className="container">
          <h2 className="section-title" style={{ color: 'white', textAlign: 'center', marginBottom: '0.5rem' }}>
            Por que elegirnos?
          </h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginBottom: '3rem' }}>
            Tu satisfaccion es nuestra prioridad
          </p>
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">🚚</div>
              <h3 className="benefit-title">Entregas a Domicilio</h3>
              <p className="benefit-text">Llevamos tu pedido hasta tu puerta, rapido y seguro.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">🏪</div>
              <h3 className="benefit-title">Atencion Mayorista</h3>
              <p className="benefit-text">Precios especiales para compras en cantidad. Consultanos.</p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">🛍️</div>
              <h3 className="benefit-title">Atencion Minorista</h3>
              <p className="benefit-text">Productos frescos y de calidad para tu hogar, al mejor precio.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Nuestros Servicios</h2>
          <p className="section-subtitle">Todo lo que ofrecemos para vos</p>
          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon">🍎</div>
              <h3 className="service-title">Frutas y Verduras Frescas</h3>
              <p className="service-text">Seleccion diaria de los mejores productos del campo, siempre frescos.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">🏬</div>
              <h3 className="service-title">Productos de Almacen</h3>
              <p className="service-text">Amplia variedad de alimentos, bebidas y productos de limpieza.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">🐾</div>
              <h3 className="service-title">Para tus Mascotas</h3>
              <p className="service-text">Todo lo que necesitan tus animales, desde alimento hasta accesorios.</p>
            </div>
            <div className="service-card">
              <div className="service-icon">🪵</div>
              <h3 className="service-title">Lena</h3>
              <p className="service-text">Lena seca y de calidad para tu hogar o asado. Entrega incluida.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="section" style={{ background: '#f0f4f0' }}>
        <div className="container">
          <h2 className="section-title">Medios de Pago</h2>
          <p className="section-subtitle">Aceptamos multiples formas de pago</p>
          <div className="payment-grid">
            <div className="payment-card">
              <div className="payment-icon">💵</div>
              <div className="payment-name">Efectivo</div>
            </div>
            <div className="payment-card">
              <div className="payment-icon">🏦</div>
              <div className="payment-name">Transferencia</div>
            </div>
            <div className="payment-card">
              <div className="payment-icon">💳</div>
              <div className="payment-name">Credito</div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Contacto</h2>
          <p className="section-subtitle">Estamos para ayudarte</p>
          <div className="contact-grid">
            <div className="contact-card">
              <div className="contact-icon">📍</div>
              <h3 className="contact-title">Ubicacion</h3>
              <p className="contact-text">{address}</p>
            </div>
            <div className="contact-card">
              <div className="contact-icon">🕐</div>
              <h3 className="contact-title">Horarios</h3>
              <p className="contact-text">{hours.split('|').map((h, i) => <span key={i}>{h.trim()}{i < hours.split('|').length - 1 ? <br /> : ''}</span>)}</p>
            </div>
            <div className="contact-card">
              <div className="contact-icon">💬</div>
              <h3 className="contact-title">WhatsApp</h3>
              <p className="contact-text">
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#25d366', fontWeight: 600 }}
                >
                  +{whatsapp}
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
