export default function Footer() {
  return (
    <footer style={{ background: '#111827', padding: '2rem', textAlign: 'center' }}>
      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem' }}>
        Mercadito la U
      </p>
      <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.75rem' }}>
        Desarrollado por{' '}
        <a
          href="https://niwebstudio.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}
        >
          niwebstudio.com
        </a>
      </p>
    </footer>
  )
}
