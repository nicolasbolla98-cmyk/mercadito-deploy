import { useState, useEffect } from 'react'
import api from '../../api/axios'

const FIELDS = [
  { key: 'store_name', label: 'Nombre del negocio', placeholder: 'Mercadito la U', type: 'text' },
  { key: 'whatsapp', label: 'WhatsApp (con codigo de pais)', placeholder: '59894022121', type: 'text', hint: 'Sin +, sin espacios. Ej: 59894022121' },
  { key: 'address', label: 'Direccion', placeholder: 'Ruta Interbalnearia km 36.500...', type: 'text' },
  { key: 'hours', label: 'Horarios', placeholder: 'Lun-Sab 8:00-20:00 | Dom 8:00-14:00', type: 'text' },
]

const BANK_FIELDS = [
  { key: 'bank_name', label: 'Banco', placeholder: 'Ej: BROU, Santander, Itau...', type: 'text' },
  { key: 'bank_account_holder', label: 'Titular de la cuenta', placeholder: 'Nombre del titular', type: 'text' },
  { key: 'bank_account_number', label: 'Numero de cuenta / CBU / IBAN', placeholder: '123456789', type: 'text' },
  { key: 'bank_extra', label: 'Dato extra (opcional)', placeholder: 'Ej: Caja de ahorro en pesos', type: 'text' },
  { key: 'transfer_note', label: 'Mensaje para el cliente al pagar por transferencia', placeholder: 'Una vez realizada la transferencia...', type: 'textarea' },
]

export default function AdminSettings() {
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/admin/settings')
      .then(res => setForm(res.data))
      .catch(() => setError('Error al cargar configuracion'))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.put('/api/admin/settings', form)
      setSuccess('Configuracion guardada correctamente')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="loading">Cargando configuracion...</div>

  return (
    <div>
      <div className="admin-header">
        <h1>Configuracion</h1>
        <p>Datos del negocio y medios de pago</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

          {/* Store info */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--light)' }}>
              Informacion del negocio
            </h2>
            {FIELDS.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input
                  type={f.type}
                  name={f.key}
                  className="form-input"
                  value={form[f.key] || ''}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                />
                {f.hint && <div style={{ fontSize: '0.78rem', color: 'var(--gray)', marginTop: '0.25rem' }}>{f.hint}</div>}
              </div>
            ))}
          </div>

          {/* Bank info */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--light)' }}>
              Datos para transferencia bancaria
            </h2>
            <div className="alert alert-info" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Estos datos se muestran al cliente cuando elige pagar por transferencia.
            </div>
            {BANK_FIELDS.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea
                    name={f.key}
                    className="form-input"
                    value={form[f.key] || ''}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                ) : (
                  <input
                    type="text"
                    name={f.key}
                    className="form-input"
                    value={form[f.key] || ''}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuracion'}
          </button>
        </div>
      </form>
    </div>
  )
}
