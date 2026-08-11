import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import api from '../api/axios'

export default function PaymentResult() {
  const [searchParams] = useSearchParams()
  const { user } = useContext(AuthContext)
  const status = searchParams.get('status')
  const orderId = searchParams.get('order_id')
  const [orderStatus, setOrderStatus] = useState(null)

  useEffect(() => {
    if (orderId) {
      api.get(`/api/payments/status/${orderId}`)
        .then(res => setOrderStatus(res.data))
        .catch(() => {})
    }
  }, [orderId])

  const isApproved = status === 'approved'
  const isPending = status === 'pending'
  const isFailure = status === 'failure'

  return (
    <div className="checkout-page">
      <div className="success-screen" style={{ maxWidth: 520, margin: '3rem auto' }}>
        {isApproved && (
          <>
            <div className="success-icon">✅</div>
            <h2 style={{ color: 'var(--green)' }}>Pago Aprobado!</h2>
            <p>Tu pago fue procesado correctamente. Tu pedido esta en preparacion.</p>
          </>
        )}
        {isPending && (
          <>
            <div className="success-icon">⏳</div>
            <h2 style={{ color: 'var(--warning)' }}>Pago en Proceso</h2>
            <p>Tu pago esta siendo procesado. Te avisaremos cuando se confirme.</p>
          </>
        )}
        {isFailure && (
          <>
            <div className="success-icon">❌</div>
            <h2 style={{ color: 'var(--danger)' }}>Pago No Completado</h2>
            <p>No pudimos procesar tu pago. Tu pedido queda registrado, podras coordinar el pago de otra forma.</p>
          </>
        )}

        {orderId && (
          <div className="success-order-id">Pedido #{orderId}</div>
        )}

        {orderStatus && (
          <p style={{ fontSize: '0.9rem', color: 'var(--gray)', marginBottom: '1rem' }}>
            Estado del pedido: <strong>{orderStatus.status}</strong>
          </p>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
          {user && (
            <Link to="/mis-pedidos" className="btn btn-primary">Ver mis pedidos</Link>
          )}
          <Link to="/catalogo" className="btn btn-secondary">Seguir comprando</Link>
        </div>
      </div>
    </div>
  )
}
