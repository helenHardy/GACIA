import React, { useState, useEffect } from 'react'
import { X, ArrowUpCircle, ArrowDownCircle, Clock, FileText, Download, RefreshCw, Printer, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function CustomerLedgerDrawer({ customer, onClose }) {
    const [transactions, setTransactions] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (customer) fetchLedger()
    }, [customer])

    async function fetchLedger() {
        try {
            setLoading(true)
            // Fetch Sales (Credit) and Payments
            const [salesRes, paymentsRes] = await Promise.all([
                supabase
                    .from('sales')
                    .select('id, total, created_at, is_credit, sale_number')
                    .eq('customer_id', customer.id)
                    .eq('is_credit', true)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('customer_payments')
                    .select('id, amount, payment_method, notes, created_at')
                    .eq('customer_id', customer.id)
                    .order('created_at', { ascending: false })
            ])

            const combined = [
                ...(salesRes.data || []).map(s => ({
                    type: 'Venta a Crédito',
                    displayType: `Venta a Crédito #${s.sale_number}`,
                    amount: s.total,
                    date: s.created_at,
                    id: s.id,
                    is_debit: true
                })),
                ...(paymentsRes.data || []).map(p => ({
                    type: 'Abono / Pago',
                    displayType: 'Abono / Pago',
                    amount: p.amount,
                    date: p.created_at,
                    id: p.id,
                    is_debit: false,
                    notes: p.notes,
                    method: p.payment_method
                }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date))

            setTransactions(combined)
        } catch (err) {
            console.error('Error fetching ledger:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 110
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '500px',
                height: '100%',
                borderRadius: 0,
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Estado de Cuenta</h2>
                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--secondary-foreground))' }}>{customer.name}</p>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.25rem' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ padding: '1.5rem', backgroundColor: 'hsl(var(--primary) / 0.1)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--primary))', textTransform: 'uppercase', fontWeight: '600' }}>Saldo Pendiente</p>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'hsl(var(--primary))' }}>
                            ${(customer.current_balance || 0).toFixed(2)}
                        </p>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontWeight: '600' }}>Movimientos Recientes</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn" style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--secondary))', gap: '0.5rem', fontSize: '0.75rem' }} onClick={() => window.print()}>
                                <Printer size={16} />
                                Imprimir
                            </button>
                            <button className="btn" style={{ padding: '0.25rem', backgroundColor: 'transparent' }} onClick={fetchLedger}>
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {loading && transactions.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                            <Loader2 size={32} className="animate-spin" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--secondary-foreground))', opacity: 0.5 }}>
                            <FileText size={48} style={{ margin: '0 auto 1rem' }} />
                            <p>No hay movimientos registrados.</p>
                        </div>
                    ) : (
                        transactions.map((tx, idx) => (
                            <div key={`${tx.type}-${tx.id}-${idx}`} style={{
                                padding: '1rem',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 'var(--radius)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div style={{
                                    padding: '0.5rem',
                                    borderRadius: '50%',
                                    backgroundColor: tx.is_debit ? 'hsl(var(--destructive) / 0.1)' : 'hsl(142 76% 36% / 0.1)',
                                    color: tx.is_debit ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)'
                                }}>
                                    {tx.is_debit ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{tx.displayType}</span>
                                        <span style={{ fontWeight: 'bold', color: tx.is_debit ? 'hsl(var(--destructive))' : 'hsl(142 76% 36%)' }}>
                                            {tx.is_debit ? '+' : '-'}${tx.amount.toFixed(2)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--secondary-foreground))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Clock size={12} />
                                        {new Date(tx.date).toLocaleString()}
                                    </div>
                                    {tx.notes && <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', fontStyle: 'italic' }}>"{tx.notes}"</p>}
                                    {tx.method && <p style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))' }}>Vía: {tx.method}</p>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
