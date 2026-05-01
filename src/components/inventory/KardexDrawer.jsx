import React, { useState, useEffect } from 'react'
import { X, RefreshCcw, AlertCircle, TrendingUp, TrendingDown, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBranch } from '../../context/BranchContext'

export default function KardexDrawer({ product, onClose }) {
    const [movements, setMovements] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const { selectedBranchId } = useBranch()

    useEffect(() => {
        if (product) fetchMovements()
    }, [product, selectedBranchId])

    async function fetchMovements() {
        try {
            setLoading(true)
            setError(null)

            let query = supabase
                .from('kardex')
                .select('quantity, balance_after, created_at')
                .eq('product_id', product.id)
                .order('created_at', { ascending: false })

            if (selectedBranchId && selectedBranchId !== 'all') {
                query = query.eq('branch_id', selectedBranchId)
            }

            const { data, error } = await query

            if (error) {
                throw new Error('No se pudo cargar el historial de cantidades.')
            }

            setMovements(data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const totalEntradas = movements.filter(m => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)
    const totalSalidas = movements.filter(m => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0)

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 150
        }} onClick={onClose}>
            <div
                style={{
                    width: '100%',
                    maxWidth: '440px',
                    height: '100%',
                    backgroundColor: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideIn 0.3s ease-out',
                    boxShadow: '-10px 0 40px rgba(0,0,0,0.1)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <style>
                    {`
                    @keyframes slideIn {
                        from { transform: translateX(100%); }
                        to { transform: translateX(0); }
                    }
                    `}
                </style>

                {/* Header */}
                <div style={{ padding: '1.5rem 1.75rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, hsl(var(--primary) / 0.03) 0%, transparent 100%)' }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, letterSpacing: '-0.02em' }}>Historial de Cantidades</h2>
                        <p style={{ fontSize: '0.85rem', fontWeight: '700', opacity: 0.5, margin: '0.15rem 0 0' }}>{product.name}</p>
                    </div>
                    <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: '10px', border: 'none', backgroundColor: 'hsl(var(--secondary) / 0.5)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Mini Stats */}
                {!loading && !error && movements.length > 0 && (
                    <div style={{ padding: '1rem 1.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                        <div style={{ padding: '0.75rem 1rem', borderRadius: '14px', backgroundColor: 'hsl(142 76% 36% / 0.06)', border: '1px solid hsl(142 76% 36% / 0.15)' }}>
                            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>Total Entradas</p>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '1.3rem', fontWeight: '900', color: 'hsl(142 76% 36%)' }}>+{totalEntradas}</p>
                        </div>
                        <div style={{ padding: '0.75rem 1rem', borderRadius: '14px', backgroundColor: 'hsl(var(--destructive) / 0.06)', border: '1px solid hsl(var(--destructive) / 0.15)' }}>
                            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.05em' }}>Total Salidas</p>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '1.3rem', fontWeight: '900', color: 'hsl(var(--destructive))' }}>-{totalSalidas}</p>
                        </div>
                    </div>
                )}

                {/* Movement List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.75rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <RefreshCcw size={32} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.3 }} />
                            <p style={{ marginTop: '1rem', fontWeight: '700', opacity: 0.4 }}>Cargando...</p>
                        </div>
                    ) : error ? (
                        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '16px' }}>
                            <AlertCircle size={40} style={{ margin: '0 auto 1rem', color: 'hsl(var(--destructive))', opacity: 0.5 }} />
                            <p style={{ fontWeight: '700', fontSize: '0.9rem' }}>{error}</p>
                        </div>
                    ) : movements.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.1 }} />
                            <p style={{ fontWeight: '800', opacity: 0.3, fontSize: '0.9rem' }}>Sin movimientos registrados</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {movements.map((move, index) => {
                                const isPositive = move.quantity > 0
                                return (
                                    <div key={index} style={{
                                        padding: '0.85rem 1.1rem',
                                        borderRadius: '14px',
                                        border: '1px solid hsl(var(--border) / 0.3)',
                                        backgroundColor: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem'
                                    }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '10px',
                                            backgroundColor: isPositive ? 'hsl(142 76% 36% / 0.08)' : 'hsl(var(--destructive) / 0.08)',
                                            color: isPositive ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <p style={{
                                                margin: 0,
                                                fontSize: '1.15rem',
                                                fontWeight: '900',
                                                color: isPositive ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))',
                                                letterSpacing: '-0.02em'
                                            }}>
                                                {isPositive ? '+' : ''}{move.quantity}
                                            </p>
                                            <p style={{ margin: '0.1rem 0 0', fontSize: '0.7rem', fontWeight: '700', opacity: 0.35 }}>
                                                {new Date(move.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })} — {new Date(move.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.35, letterSpacing: '0.05em' }}>Saldo</p>
                                            <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', letterSpacing: '-0.02em' }}>{move.balance_after ?? '—'}</p>
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
