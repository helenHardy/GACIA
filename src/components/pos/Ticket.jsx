import React, { forwardRef } from 'react'

function numeroALetras(numero) {
    const un = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
    const dec = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const cen = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (numero === 0) return 'CERO';
    if (numero === 100) return 'CIEN';

    function getLetras(n) {
        if (n <= 20) return un[n];
        if (n < 30) return dec[2] + un[n % 10];
        if (n < 100) return dec[Math.floor(n / 10)] + (n % 10 !== 0 ? ' Y ' + un[n % 10] : '');
        if (n < 1000) return cen[Math.floor(n / 100)] + (n % 100 !== 0 ? ' ' + getLetras(n % 100) : '');
        if (n === 1000) return 'MIL';
        if (n < 2000) return 'MIL ' + (n % 1000 !== 0 ? getLetras(n % 1000) : '');
        if (n < 1000000) return getLetras(Math.floor(n / 1000)) + ' MIL' + (n % 1000 !== 0 ? ' ' + getLetras(n % 1000) : '');
        if (n === 1000000) return 'UN MILLON';
        return n.toString();
    }
    
    let enteros = Math.floor(numero);
    let decimales = Math.round((numero - enteros) * 100);
    return `Son: ${getLetras(enteros)} ${decimales.toString().padStart(2, '0')}/100 Bolivianos`;
}

const Ticket = forwardRef(({ sale, items, branch, customer, seller, paymentMethod, currencySymbol = 'Bs.' }, ref) => {
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
            color: 'black',
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
                .bw-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                }
                .bw-table th, .bw-table td {
                    border: 1px solid black;
                    padding: 6px 10px;
                }
                .bw-table th {
                    background-color: #f0f0f0 !important; /* light grey for printing */
                    color: black;
                    font-weight: bold;
                    text-align: center;
                }
                `}
            </style>

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: 'black' }}>GACIA</h1>
                    <div style={{ color: 'black', fontSize: '11px', marginTop: '4px' }}>
                        <p style={{ margin: '0 0 2px 0' }}>{branch?.name || 'Casa Matriz'}</p>
                        <p style={{ margin: '0' }}>Tel: {branch?.phone || '000-0000'}</p>
                        <div style={{ marginTop: '10px', border: '1px solid black', padding: '4px 8px', display: 'inline-block' }}>
                            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Cliente: </span>
                            <span>{customer?.name || 'Cliente de Mostrador'}</span>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ border: '1px solid black', padding: '8px 15px', display: 'inline-block', marginBottom: '5px' }}>
                        <h2 style={{ margin: '0 0 2px 0', color: 'black', fontSize: '14px', fontWeight: 'bold' }}>COMPROBANTE</h2>
                        <p style={{ margin: '0', fontSize: '12px', fontWeight: 'bold' }}>#{sale.sale_number || sale.id?.toString().slice(-6).toUpperCase()}</p>
                    </div>
                    <div style={{ color: 'black', fontSize: '11px', marginTop: '5px' }}>
                        <p style={{ margin: '0 0 2px 0' }}><strong>Fecha:</strong> {new Date(sale.created_at).toLocaleDateString()} | {new Date(sale.created_at).toLocaleTimeString()}</p>
                        {seller && <p style={{ margin: '0' }}><strong>Cajero/Vendedor:</strong> {seller.full_name || seller.name || '---'}</p>}
                    </div>
                </div>
            </div>

            {/* Items table */}
            <table className="bw-table">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left' }}>Código</th>
                        <th style={{ textAlign: 'left' }}>Nombre</th>
                        <th style={{ textAlign: 'center' }}>Cantidad</th>
                        <th style={{ textAlign: 'right' }}>P. Unitario</th>
                        <th style={{ textAlign: 'right' }}>Sub Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td>{item.sku || 'N/A'}</td>
                            <td>{item.name}</td>
                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>{item.price.toFixed(2)} {currencySymbol}</td>
                            <td style={{ textAlign: 'right' }}>{(item.price * item.quantity).toFixed(2)} {currencySymbol}</td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>TOTAL:</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{subtotal.toFixed(2)} {currencySymbol}</td>
                    </tr>
                </tbody>
            </table>

            {/* Totals and Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '10px' }}>
                <div style={{ width: '60%' }}>
                    {sale.notes && (
                        <div style={{ padding: '8px', border: '1px dashed black', marginBottom: '10px' }}>
                            <h4 style={{ margin: '0 0 4px 0', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Notas:</h4>
                            <p style={{ margin: 0, fontSize: '11px' }}>{sale.notes}</p>
                        </div>
                    )}
                    <p style={{ fontStyle: 'italic', margin: '15px 0 0 0', fontSize: '12px' }}>
                        {numeroALetras(total)}
                    </p>
                    <p style={{ marginTop: '10px', fontWeight: 'bold', fontSize: '11px', color: 'black' }}>
                        MÉTODO: {paymentMethod || sale.payment_method}
                    </p>
                </div>

                <div style={{ width: '200px', textAlign: 'right', fontSize: '12px' }}>
                    <div style={{ marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '10px' }}>Sub Total:</span>
                        <span>{subtotal.toFixed(2)} {currencySymbol}</span>
                    </div>
                    {sale.discount > 0 && (
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '10px' }}>Descuento:</span>
                            <span>{sale.discount.toFixed(2)} {currencySymbol}</span>
                        </div>
                    )}
                    {tax > 0 && (
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', marginRight: '10px' }}>IVA (13%):</span>
                            <span>{tax.toFixed(2)} {currencySymbol}</span>
                        </div>
                    )}
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '2px solid black', fontSize: '14px' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '10px' }}>TOTAL NETO:</span>
                        <span style={{ fontWeight: 'bold' }}>{total.toFixed(2)} {currencySymbol}</span>
                    </div>
                </div>
            </div>
        </div>
    )
})

Ticket.displayName = 'Ticket'

export default Ticket
