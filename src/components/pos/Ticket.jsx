import React, { forwardRef } from 'react'

const Ticket = forwardRef(({ sale, items, branch, customer, paymentMethod, currencySymbol = 'Bs.' }, ref) => {
    if (!sale) return null

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const tax = sale.tax !== undefined ? sale.tax : (subtotal * 0.13)
    const total = sale.total !== undefined ? sale.total : (subtotal + tax)

    return (
        <div ref={ref} className="ticket-container" style={{
            width: '210mm',
            minHeight: '270mm',
            padding: '10mm 15mm',
            backgroundColor: 'white',
            color: '#1a1a1a',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            fontSize: '11px',
            lineHeight: '1.4',
            margin: '0 auto',
            boxSizing: 'border-box'
        }}>
            <style>
                {`
                @media print {
                    @page { 
                        size: A4; 
                        margin: 5mm; 
                    }
                    body { 
                        margin: 0; 
                        background: white !important; 
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    .ticket-container { 
                        width: 200mm; 
                        height: auto;
                        padding: 5mm;
                        box-shadow: none !important;
                        margin: 0 !important;
                    }
                }
                .invoice-table th {
                    background-color: #f8f9fa !important;
                    color: #4a5568;
                    text-transform: uppercase;
                    font-size: 9px;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                }
                `}
            </style>

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#1a365d', letterSpacing: '-0.04em' }}>GACIA</h1>
                    </div>
                    <div style={{ color: '#4a5568', fontSize: '10px' }}>
                        <p style={{ margin: '0 0 1px 0', fontWeight: '700' }}>{branch?.name || 'Casa Matriz'}</p>
                        <p style={{ margin: '0' }}>Tel: {branch?.phone || '000-0000'}</p>
                        <div style={{ marginTop: '8px', padding: '4px 10px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #eee', display: 'inline-block' }}>
                            <span style={{ fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', fontSize: '8px', marginRight: '5px' }}>Cliente:</span>
                            <span style={{ fontWeight: '700', fontSize: '11px' }}>{customer?.name || 'Cliente de Mostrador'}</span>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ backgroundColor: '#f1f5f9', padding: '8px 15px', borderRadius: '10px', display: 'inline-block', marginBottom: '5px' }}>
                        <h2 style={{ margin: '0 0 1px 0', color: '#2563eb', fontSize: '14px', fontWeight: '900' }}>COMPROBANTE</h2>
                        <p style={{ margin: '0', fontSize: '12px', fontWeight: '700', opacity: 0.6 }}>#{sale.sale_number || sale.id.toString().slice(-6).toUpperCase()}</p>
                    </div>
                    <div style={{ color: '#4a5568', fontSize: '10px' }}>
                        <p style={{ margin: '0' }}><strong>Fecha:</strong> {new Date(sale.created_at).toLocaleDateString()} | {new Date(sale.created_at).toLocaleTimeString()}</p>
                        <p style={{ margin: '2px 0 0 0', color: '#2563eb', fontWeight: '800' }}><strong>MÉTODO:</strong> {paymentMethod || sale.payment_method}</p>
                    </div>
                </div>
            </div>

            <hr style={{ border: 'none', height: '1px', backgroundColor: '#e2e8f0', margin: '8px 0' }} />

            {/* Items table */}
            <table className="invoice-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0', marginBottom: '15px' }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left', padding: '8px 12px', borderTopLeftRadius: '8px', borderBottom: '2px solid #e2e8f0' }}>Descripción</th>
                        <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '2px solid #e2e8f0' }}>Cant.</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid #e2e8f0' }}>P. Unit</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', borderTopRightRadius: '8px', borderBottom: '2px solid #e2e8f0' }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td style={{ padding: '6px 12px', borderBottom: '1px solid #edf2f7' }}>
                                <div style={{ fontWeight: '700', fontSize: '11px' }}>{item.name}</div>
                                <div style={{ fontSize: '9px', color: '#718096' }}>{item.sku || 'SKU: N/A'}</div>
                            </td>
                            <td style={{ textAlign: 'center', padding: '6px 12px', borderBottom: '1px solid #edf2f7', fontWeight: '600' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right', padding: '6px 12px', borderBottom: '1px solid #edf2f7', color: '#4a5568' }}>{currencySymbol}{item.price.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', padding: '6px 12px', borderBottom: '1px solid #edf2f7', fontWeight: '700' }}>{currencySymbol}{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {/* Notes section moved to left to save space */}
                <div style={{ flex: 1, marginRight: '20px' }}>
                    {sale.notes && (
                        <div style={{ padding: '8px 12px', border: '1px dashed #cbd5e0', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 3px 0', fontSize: '9px', fontWeight: '800', color: '#718096', textTransform: 'uppercase' }}>Notas:</h4>
                            <p style={{ margin: 0, fontSize: '10px', color: '#2d3748', whiteSpace: 'pre-wrap' }}>{sale.notes}</p>
                        </div>
                    )}
                </div>

                <div style={{ width: '220px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', fontSize: '10px' }}>
                        <span style={{ color: '#718096', fontWeight: '600' }}>Subtotal:</span>
                        <span style={{ fontWeight: '700' }}>{currencySymbol}{subtotal.toFixed(2)}</span>
                    </div>
                    {tax > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', fontSize: '10px' }}>
                            <span style={{ color: '#718096', fontWeight: '600' }}>IVA (13%):</span>
                            <span style={{ fontWeight: '700' }}>{currencySymbol}{tax.toFixed(2)}</span>
                        </div>
                    )}
                    {sale.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', color: '#e53e3e', fontSize: '10px' }}>
                            <span style={{ fontWeight: '600' }}>Descuento:</span>
                            <span style={{ fontWeight: '700' }}>-{currencySymbol}{sale.discount.toFixed(2)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 15px', backgroundColor: '#2563eb', borderRadius: '12px', color: 'white', marginTop: '5px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800' }}>TOTAL:</span>
                        <span style={{ fontSize: '18px', fontWeight: '900' }}>{currencySymbol}{total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Footer removed per user request */}
        </div>
    )
})

Ticket.displayName = 'Ticket'

export default Ticket
