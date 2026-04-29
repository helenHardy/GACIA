import React, { forwardRef } from 'react'

const Ticket = forwardRef(({ sale, items, branch, customer, paymentMethod, currencySymbol = 'Bs.' }, ref) => {
    if (!sale) return null

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const tax = sale.tax !== undefined ? sale.tax : (subtotal * 0.13)
    const total = sale.total !== undefined ? sale.total : (subtotal + tax)

    return (
        <div ref={ref} className="ticket-container" style={{
            width: '210mm', // A4/Letter width approx
            minHeight: '270mm',
            padding: '20mm',
            backgroundColor: 'white',
            color: '#1a1a1a',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            fontSize: '12px',
            lineHeight: '1.5',
            margin: '0 auto',
            boxSizing: 'border-box'
        }}>
            <style>
                {`
                @media print {
                    @page { 
                        size: A4; 
                        margin: 0; 
                    }
                    body { 
                        margin: 0; 
                        background: white !important; 
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    .ticket-container { 
                        width: 210mm; 
                        height: 297mm;
                        padding: 15mm;
                        box-shadow: none !important;
                        margin: 0 !important;
                    }
                }
                .invoice-table th {
                    background-color: #f8f9fa !important;
                    color: #4a5568;
                    text-transform: uppercase;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                }
                `}
            </style>

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ width: '48px', height: '48px', backgroundColor: '#2563eb', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <span style={{ fontWeight: '900', fontSize: '24px' }}>A</span>
                        </div>
                        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: '#1a365d', letterSpacing: '-0.04em' }}>GACIA ERP</h1>
                    </div>
                    <div style={{ color: '#4a5568' }}>
                        <p style={{ margin: '0 0 4px 0', fontWeight: '700', fontSize: '14px' }}>{branch?.name || 'Casa Matriz'}</p>
                        <p style={{ margin: '0 0 2px 0' }}>{branch?.address || 'Dirección de la sucursal'}</p>
                        <p style={{ margin: '0 0 2px 0' }}>Santa Cruz - Bolivia</p>
                        <p style={{ margin: '0' }}>Tel: {branch?.phone || '000-0000'}</p>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ backgroundColor: '#f1f5f9', padding: '20px 30px', borderRadius: '16px', display: 'inline-block' }}>
                        <h2 style={{ margin: '0 0 8px 0', color: '#2563eb', fontSize: '20px', fontWeight: '900' }}>COMPROBANTE</h2>
                        <p style={{ margin: '0', fontSize: '16px', fontWeight: '700', opacity: 0.6 }}>#{sale.id.toString().slice(-8).toUpperCase()}</p>
                    </div>
                    <div style={{ marginTop: '16px', color: '#4a5568' }}>
                        <p style={{ margin: '0 0 4px 0' }}><strong>Fecha:</strong> {new Date(sale.created_at).toLocaleDateString()}</p>
                        <p style={{ margin: '0' }}><strong>Hora:</strong> {new Date(sale.created_at).toLocaleTimeString()}</p>
                    </div>
                </div>
            </div>

            <hr style={{ border: 'none', height: '1px', backgroundColor: '#e2e8f0', margin: '30px 0' }} />

            {/* Client & Info section */}
            <div style={{ display: 'flex', gap: '40px', marginBottom: '40px' }}>
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Facturar a:</h3>
                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '16px' }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '800' }}>{customer?.name || 'Cliente de Mostrador'}</p>
                        <p style={{ margin: '0 0 4px 0', color: '#4a5568' }}>NIT/CI: {customer?.tax_id || 'N/A'}</p>
                        <p style={{ margin: '0', color: '#4a5568' }}>{customer?.address || 'Sin dirección registrada'}</p>
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Detalles del Pago:</h3>
                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '16px' }}>
                        <p style={{ margin: '0 0 4px 0' }}><strong>Método:</strong> {paymentMethod || sale.payment_method}</p>
                        <p style={{ margin: '0 0 4px 0' }}><strong>Estado:</strong> Pagado</p>
                        <p style={{ margin: '0' }}><strong>Moneda:</strong> Bolivianos ({currencySymbol})</p>
                    </div>
                </div>
            </div>

            {/* Items table */}
            <table className="invoice-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', marginBottom: '40px' }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left', padding: '12px 20px', borderTopLeftRadius: '12px', borderBottom: '2px solid #e2e8f0' }}>Descripción del Producto</th>
                        <th style={{ textAlign: 'center', padding: '12px 20px', borderBottom: '2px solid #e2e8f0' }}>Cant.</th>
                        <th style={{ textAlign: 'right', padding: '12px 20px', borderBottom: '2px solid #e2e8f0' }}>Precio Unit.</th>
                        <th style={{ textAlign: 'right', padding: '12px 20px', borderTopRightRadius: '12px', borderBottom: '2px solid #e2e8f0' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td style={{ padding: '16px 20px', borderBottom: '1px solid #edf2f7' }}>
                                <div style={{ fontWeight: '700', fontSize: '13px' }}>{item.name}</div>
                                <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>{item.sku || 'SKU: N/A'}</div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '16px 20px', borderBottom: '1px solid #edf2f7', fontWeight: '600' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right', padding: '16px 20px', borderBottom: '1px solid #edf2f7', color: '#4a5568' }}>{currencySymbol}{item.price.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', padding: '16px 20px', borderBottom: '1px solid #edf2f7', fontWeight: '700' }}>{currencySymbol}{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals section */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '300px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px' }}>
                        <span style={{ color: '#718096', fontWeight: '600' }}>Subtotal:</span>
                        <span style={{ fontWeight: '700' }}>{currencySymbol}{subtotal.toFixed(2)}</span>
                    </div>
                    {tax > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px' }}>
                            <span style={{ color: '#718096', fontWeight: '600' }}>IVA (13%):</span>
                            <span style={{ fontWeight: '700' }}>{currencySymbol}{tax.toFixed(2)}</span>
                        </div>
                    )}
                    {sale.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px', color: '#e53e3e' }}>
                            <span style={{ fontWeight: '600' }}>Descuento:</span>
                            <span style={{ fontWeight: '700' }}>-{currencySymbol}{sale.discount.toFixed(2)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px', backgroundColor: '#2563eb', borderRadius: '16px', color: 'white', marginTop: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: '800' }}>TOTAL:</span>
                        <span style={{ fontSize: '22px', fontWeight: '900' }}>{currencySymbol}{total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: 'auto', paddingTop: '60px', textAlign: 'center' }}>
                <div style={{ padding: '30px', backgroundColor: '#f8f9fa', borderRadius: '24px' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '800', color: '#1a365d' }}>¡GRACIAS POR SU PREFERENCIA!</p>
                    <p style={{ margin: '0 0 20px 0', fontSize: '11px', color: '#718096' }}>Este documento es un comprobante de venta interna y no tiene validez fiscal.</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
                        <div style={{ fontSize: '10px', color: '#a0aec0' }}>
                            <p style={{ margin: 0 }}>Generado por</p>
                            <p style={{ margin: 0, fontWeight: '700' }}>GACIA ERP v2.0</p>
                        </div>
                        <div style={{ fontSize: '10px', color: '#a0aec0' }}>
                            <p style={{ margin: 0 }}>Fecha de Impresión</p>
                            <p style={{ margin: 0, fontWeight: '700' }}>{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
})

Ticket.displayName = 'Ticket'

export default Ticket
