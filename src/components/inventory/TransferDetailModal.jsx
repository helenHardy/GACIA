import React, { useState, useEffect, useCallback } from 'react'
import { X, Package, ArrowRight, Loader2, MapPin, ClipboardList, Info, Printer, Truck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function TransferDetailModal({ transfer, onClose }) {
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchItems = useCallback(async () => {
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
    }, [transfer])

    useEffect(() => {
        if (transfer) fetchItems()
    }, [transfer, fetchItems])

    function handlePrint() {
        if (!transfer) return

        const printWindow = window.open('', '_blank', 'width=800,height=900')
        const totalUnits = items.reduce((acc, i) => acc + Number(i.quantity || 0), 0)

        const statusBadge = {
            Pendiente: '<span style="background:#f1f5f9;color:#475569;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;">PENDIENTE</span>',
            Enviado: '<span style="background:#e0f2fe;color:#0369a1;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;">ENVIADO</span>',
            Recibido: '<span style="background:#dcfce7;color:#15803d;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;">RECIBIDO</span>',
            Cancelado: '<span style="background:#fee2e2;color:#b91c1c;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;">CANCELADO</span>'
        }[transfer.status] || transfer.status

        printWindow.document.write(`
            <html>
                <head>
                    <title>Comprobante de Traspaso #${transfer.transfer_number}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #334155; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
                        td { border: 1px solid #e2e8f0; padding: 12px; font-size: 13px; }
                        .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                        .route { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
                        .route .box { text-align: center; flex: 1; }
                        .route .arrow { color: #0284c7; font-size: 22px; font-weight: 800; }
                        .route p { margin: 4px 0; }
                        .route .label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #94a3b8; }
                        .route .value { font-size: 15px; font-weight: 800; color: #1e293b; }
                        .total-row { background-color: #f1f5f9; font-weight: bold; font-size: 14px; }
                        .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px dashed #eee; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h1 style="margin: 0; color: #1e293b;">COMPROBANTE DE TRASPASO</h1>
                            <p style="margin: 5px 0; color: #64748b;">N° de Traspaso: <strong>#${transfer.transfer_number}</strong></p>
                            <p style="margin: 5px 0; color: #64748b;">Fecha: ${new Date(transfer.created_at).toLocaleString()}</p>
                        </div>
                        <div style="text-align: right;">
                            ${statusBadge}
                            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px;">
                                Enviado por: <strong>${transfer.sender?.full_name?.split(' ')[0] || 'Sistema'}</strong><br/>
                                ${transfer.receiver ? `Recibido por: <strong>${transfer.receiver.full_name?.split(' ')[0] || 'Sistema'}</strong>` : 'Aún no recibido'}
                            </p>
                        </div>
                    </div>

                    <div class="route">
                        <div class="box">
                            <p class="label">Sucursal de Origen</p>
                            <p class="value">${transfer.origin?.name || 'N/A'}</p>
                        </div>
                        <div class="arrow">→</div>
                        <div class="box">
                            <p class="label">Sucursal de Destino</p>
                            <p class="value">${transfer.destination?.name || 'N/A'}</p>
                        </div>
                    </div>

                    <h3 style="margin: 0 0 12px 0; text-transform: uppercase; font-size: 14px;">Contenido del Envío</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Producto</th>
                                <th style="text-align: center;">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? '<tr><td colspan="3" style="text-align:center;opacity:0.5;">Sin productos registrados</td></tr>' : items.map(item => `
                                <tr>
                                    <td>${item.products?.sku || 'N/A'}</td>
                                    <td>${item.products?.name || 'Producto Desconocido'}</td>
                                    <td style="text-align: center; font-weight: bold;">${item.quantity}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2" style="text-align: right; padding: 12px;">TOTAL UNIDADES</td>
                                <td style="text-align: center; padding: 12px;">${totalUnits}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="footer">
                        Documento generado automáticamente por el Sistema de Gestión de Inventario
                    </div>
                </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
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
                    <button className="btn" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: '800', backgroundColor: 'hsl(var(--primary) / 0.05)', color: 'hsl(var(--primary))', border: '1.5px solid hsl(var(--primary))', cursor: 'pointer' }}>
                        <Printer size={18} /> IMPRIMIR
                    </button>
                    <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={onClose} style={{ padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: '800' }}>
                        CERRAR VISTA
                    </button>
                </div>
            </div>
        </div>
    )
}
