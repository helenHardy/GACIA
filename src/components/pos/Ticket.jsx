import React, { forwardRef } from 'react'

const Ticket = forwardRef(({ sale, items, branch, customer, paymentMethod, currencySymbol = 'Bs.' }, ref) => {
    if (!sale) return null

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const tax = sale.tax !== undefined ? sale.tax : (subtotal * 0.13)
    const total = sale.total !== undefined ? sale.total : (subtotal + tax)

    return (
        <div ref={ref} className="ticket-container" style={{
            width: '80mm',
            padding: '8mm 4mm',
            backgroundColor: 'white',
            color: 'black',
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: '11px',
            lineHeight: '1.3'
        }}>
            <style>
                {`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body { margin: 0; background: white !important; }
                    .no-print { display: none !important; }
                    .ticket-container { width: 100%; padding: 4mm; }
                }
                `}
            </style>

            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold' }}>GACIA ERP</h2>
                <p style={{ margin: '1px 0', fontWeight: 'bold' }}>{branch?.name || 'Sucursal Central'}</p>
                <p style={{ margin: '1px 0', fontSize: '10px' }}>{branch?.address || 'Dirección de la sucursal'}</p>
                <p style={{ margin: '1px 0', fontSize: '10px' }}>Tel: {branch?.phone || '000-0000'}</p>
            </div>

            <div style={{ borderTop: '1px dashed #000', padding: '8px 0', fontSize: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>ORDEN: #{sale.id.toString().slice(-8).toUpperCase()}</span>
                </div>
                <div>FECHA: {new Date(sale.created_at).toLocaleString()}</div>
                <div>METODO: {paymentMethod || sale.payment_method}</div>
                {customer && (
                    <div style={{ marginTop: '4px', borderTop: '1px dotted #ccc', paddingTop: '4px' }}>
                        <div>CLIENTE: {customer.name}</div>
                        <div>NIT/CI: {customer.tax_id || 'N/A'}</div>
                    </div>
                )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '8px 0' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #000' }}>
                        <th style={{ textAlign: 'left', padding: '4px 0', fontSize: '10px' }}>DETALLE</th>
                        <th style={{ textAlign: 'center', padding: '4px 0', fontSize: '10px' }}>CANT</th>
                        <th style={{ textAlign: 'right', padding: '4px 0', fontSize: '10px' }}>SUBT</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td style={{ padding: '4px 0', verticalAlign: 'top' }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{item.name}</div>
                                <div style={{ fontSize: '9px', opacity: 0.7 }}>{currencySymbol}{item.price.toFixed(2)} c/u</div>
                            </td>
                            <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '4px 0' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right', verticalAlign: 'top', padding: '4px 0', fontWeight: 'bold' }}>{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ textAlign: 'right', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>SUBTOTAL:</span>
                    <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                </div>
                {tax > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span>IMPUESTO:</span>
                        <span>{currencySymbol}{tax.toFixed(2)}</span>
                    </div>
                )}
                {sale.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#d00' }}>
                        <span>DESCUENTO:</span>
                        <span>-{currencySymbol}{sale.discount.toFixed(2)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', borderTop: '1px solid #000', paddingTop: '4px', fontSize: '14px', fontWeight: 'bold' }}>
                    <span>TOTAL:</span>
                    <span>{currencySymbol}{total.toFixed(2)}</span>
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px dashed #000', paddingTop: '10px' }}>
                <p style={{ margin: '0', fontSize: '11px', fontWeight: 'bold' }}>¡GRACIAS POR SU PREFERENCIA!</p>
                <p style={{ margin: '2px 0', fontSize: '9px', opacity: 0.7 }}>Este no es un documento fiscal válido</p>
                <p style={{ margin: '10px 0 0 0', fontSize: '8px', opacity: 0.5 }}>Generado por GACIA ERP System</p>
            </div>
        </div>
    )
})

Ticket.displayName = 'Ticket'

export default Ticket
