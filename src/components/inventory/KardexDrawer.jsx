import React, { useState, useEffect } from 'react'
import { X, ArrowUpRight, ArrowDownLeft, RefreshCcw, ShoppingCart, Truck, Repeat, Clock, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function KardexDrawer({ product, onClose }) {
    const [movements, setMovements] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (product) fetchMovements()
    }, [product])

    async function fetchMovements() {
        try {
            setLoading(true)
            setError(null)

            // Intentar buscar en una tabla 'kardex' si existe, 
            // sino, podemos intentar reconstruir de sales_items, purchase_items, transfer_items
            // Para este ejemplo, asumiremos que existe una tabla consolidada o vista 'kardex'
            // Si falla, informaremos que el historial no está disponible o requiere triggers.

            const { data, error } = await supabase
                .from('kardex')
                .select('*')
                .eq('product_id', product.id)
                .order('created_at', { ascending: false })

            if (error) {
                console.warn('Kardex table not found or error:', error)
                // Fallback: Mostrar mensaje informativo si la tabla no existe
                throw new Error('La tabla de historial (kardex) no está configurada aún en la base de datos.')
            }

            setMovements(data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const getMovementIcon = (type) => {
        switch (type) {
            case 'VENTA': return <ShoppingCart size={18} style={{ color: 'hsl(var(--destructive))' }} />
            case 'COMPRA': return <Truck size={18} style={{ color: 'hsl(142 76% 36%)' }} />
            case 'TRASPASO_ENTRADA': return <ArrowDownLeft size={18} style={{ color: 'hsl(var(--primary))' }} />
            case 'TRASPASO_SALIDA': return <ArrowUpRight size={18} style={{ color: 'hsl(var(--accent))' }} />
            case 'AJUSTE': return <RefreshCcw size={18} style={{ color: 'hsl(var(--secondary-foreground))' }} />
            default: return <Clock size={18} />
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
            zIndex: 150
        }} onClick={onClose}>
            <div
                style={{
                    width: '100%',
                    maxWidth: '500px',
                    height: '100%',
                    backgroundColor: 'hsl(var(--background))',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideIn 0.3s ease-out'
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

                <div style={{ padding: '1.5rem', borderBottom: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Historial de Movimientos</h2>
                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--secondary-foreground))' }}>{product.name}</p>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <RefreshCcw size={32} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))' }} />
                            <p style={{ marginTop: '1rem' }}>Cargando historial...</p>
                        </div>
                    ) : error ? (
                        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: 'var(--radius)' }}>
                            <AlertCircle size={48} style={{ margin: '0 auto 1rem', color: 'hsl(var(--destructive))' }} />
                            <p style={{ fontWeight: '500' }}>{error}</p>
                            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', opacity: 0.7 }}>
                                Se requiere configurar triggers en Supabase para poblar automáticamente el Kardex.
                            </p>
                        </div>
                    ) : movements.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--secondary-foreground))' }}>
                            <Clock size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                            <p>No hay movimientos registrados para este producto.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {movements.map((move, index) => (
                                <div key={index} className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'start' }}>
                                    <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: 'var(--radius)' }}>
                                        {getMovementIcon(move.type)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{move.type}</span>
                                            <span style={{
                                                fontWeight: 'bold',
                                                color: move.quantity > 0 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))'
                                            }}>
                                                {move.quantity > 0 ? '+' : ''}{move.quantity}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'hsl(var(--secondary-foreground))', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{new Date(move.created_at).toLocaleString()}</span>
                                            <span>Saldo: {move.balance_after}</span>
                                        </div>
                                        {move.notes && (
                                            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontStyle: 'italic' }}>"{move.notes}"</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
