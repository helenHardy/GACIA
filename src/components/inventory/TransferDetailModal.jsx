import React, { useState, useEffect } from 'react'
import { X, Package, ArrowRight, Loader2, MapPin, ClipboardList, Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function TransferDetailModal({ transfer, onClose }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (transfer) fetchItems()
    }, [transfer])

    async function fetchItems() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('transfer_items')
                .select('*, products(name, sku)')
                .eq('transfer_id', transfer.id)

            if (error) throw error
            setItems(data || [])
        } catch (err) {
            console.error('Error fetching transfer items:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 150, padding: '1rem'
        }}>
            <div className="card shadow-2xl" style={{
                width: '100%',
                maxWidth: '650px',
                padding: 0,
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '20px',
                overflow: 'hidden',
                backgroundColor: 'hsl(var(--background))'
            }}>
                {/* Header Section */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid hsl(var(--border) / 0.6)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'hsl(var(--secondary) / 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            padding: '0.6rem',
                            backgroundColor: 'hsl(var(--primary) / 0.1)',
                            color: 'hsl(var(--primary))',
                            borderRadius: '12px'
                        }}>
                            <ClipboardList size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                                Detalles del Traspaso #{transfer.transfer_number}
                            </h2>
                            <p style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Historial de movimiento logístico</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>
                    {/* Routing Info */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'hsl(var(--secondary) / 0.05)', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.4)' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Origen</p>
                            <p style={{ fontWeight: '800', fontSize: '1rem', margin: 0 }}>{transfer.origin?.name}</p>
                        </div>
                        <div style={{ color: 'hsl(var(--primary))', opacity: 0.5 }}>
                            <ArrowRight size={20} />
                        </div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.4, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Destino</p>
                            <p style={{ fontWeight: '800', fontSize: '1rem', margin: 0 }}>{transfer.destination?.name}</p>
                        </div>
                    </div>

                    <h3 style={{ fontSize: '0.875rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--primary))', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={16} /> Contenido del Envío
                    </h3>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', opacity: 0.3 }}>
                            <Loader2 size={32} className="animate-spin" />
                            <p style={{ marginTop: '1rem', fontWeight: '600' }}>Cargando lista...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.3 }}>
                            <Package size={48} style={{ margin: '0 auto 1rem' }} />
                            <p style={{ fontWeight: '700' }}>No se encontraron productos en este traspaso.</p>
                        </div>
                    ) : (
                        <div style={{ borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.5)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                                    <tr>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Producto</th>
                                        <th style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Cantidad</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map(item => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{item.products?.name}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>SKU: {item.products?.sku}</div>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                <span style={{ fontWeight: '800', padding: '4px 10px', backgroundColor: 'hsl(var(--secondary))', borderRadius: '8px', fontSize: '0.9rem' }}>
                                                    {item.quantity} uds.
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderTop: '1px solid hsl(var(--border) / 0.6)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'hsl(var(--secondary) / 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.5, textTransform: 'uppercase', margin: 0 }}>Volumen Total</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0 }}>
                                {items.reduce((acc, i) => acc + i.quantity, 0)} <span style={{ fontSize: '0.8rem', fontWeight: '600', opacity: 0.5 }}>unidades</span>
                            </p>
                        </div>
                    </div>
                    <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={onClose} style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: '800' }}>
                        CERRAR VISTA
                    </button>
                </div>
            </div>
        </div>
    )
}
