import React, { useState } from 'react'
import { X, Save, DollarSign, Calendar, Loader2 } from 'lucide-react'

export default function CustomerPaymentsModal({ customer, onClose, onSave, isSaving }) {
    const [amount, setAmount] = useState('')
    const [method, setMethod] = useState('Efectivo')
    const [notes, setNotes] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        const paymentAmount = parseFloat(amount)
        if (isNaN(paymentAmount) || paymentAmount <= 0) return alert('Ingrese un monto válido')

        onSave({
            customer_id: customer.id,
            amount: paymentAmount,
            payment_method: method,
            notes: notes
        })
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Registrar Pago</h2>
                    <button onClick={onClose} className="btn" style={{ padding: '0.25rem' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderRadius: 'var(--radius)' }}>
                    <p style={{ fontSize: '0.875rem', color: 'hsl(var(--secondary-foreground))' }}>Cliente</p>
                    <p style={{ fontWeight: 'bold' }}>{customer.name}</p>
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Deuda: <span style={{ color: 'hsl(var(--destructive))', fontWeight: 'bold' }}>${(customer.current_balance || 0).toFixed(2)}</span></p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Monto a Pagar</label>
                        <div style={{ position: 'relative' }}>
                            <DollarSign size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                            <input
                                required
                                type="number"
                                step="0.01"
                                className="btn"
                                style={{ width: '100%', paddingLeft: '2.5rem', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', justifyContent: 'flex-start' }}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Método de Pago</label>
                        <select
                            className="btn"
                            style={{ width: '100%', backgroundColor: 'hsl(var(--secondary))', cursor: 'pointer' }}
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                        >
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Depósito">Depósito</option>
                            <option value="QR">QR</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Notas / Referencia</label>
                        <textarea
                            className="btn"
                            style={{ width: '100%', minHeight: '80px', padding: '0.75rem', backgroundColor: 'hsl(var(--secondary))', cursor: 'text', justifyContent: 'flex-start', alignItems: 'flex-start' }}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: Pago de factura #123"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSaving}
                        style={{ padding: '0.75rem', gap: '0.5rem' }}
                    >
                        {isSaving ? <><Loader2 size={18} className="animate-spin" /> Procesando...</> : <><Save size={18} /> Registrar Pago</>}
                    </button>
                </form>
            </div>
        </div>
    )
}
