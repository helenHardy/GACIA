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
    let letras = getLetras(enteros);
    if (letras) {
        letras = letras.charAt(0).toUpperCase() + letras.slice(1).toLowerCase();
    }
    return `${letras} ${decimales.toString().padStart(2, '0')}/100 Bolivianos`;
}

function formatSpanishDate(dateString) {
    const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${day.toString().padStart(2, '0')} de ${month} del ${year} / ${hours}:${minutes}:${seconds}`;
}

const parsePaymentDetails = (methodStr, totalVal) => {
    const info = {
        type: 'Efectivo',
        cash: totalVal,
        digital: 0,
        digitalType: 'QR',
        isMixed: false
    };

    if (!methodStr) return info;

    if (methodStr.includes('Mixto')) {
        info.type = 'Mixto';
        info.isMixed = true;
        const cashMatch = methodStr.match(/Efectivo:\s*([\d.]+)/i);
        if (cashMatch) {
            info.cash = parseFloat(cashMatch[1]);
        }
        const digitalMatch = methodStr.match(/\+\s*([^:]+):\s*([\d.]+)/i);
        if (digitalMatch) {
            info.digitalType = digitalMatch[1].trim();
            info.digital = parseFloat(digitalMatch[2]);
        }
    } else if (methodStr.toLowerCase().includes('qr')) {
        info.type = 'QR';
        info.digitalType = 'QR';
        info.digital = totalVal;
        info.cash = 0;
    } else if (methodStr.toLowerCase().includes('transferencia')) {
        info.type = 'Transferencia';
        info.digitalType = 'Transferencia';
        info.digital = totalVal;
        info.cash = 0;
    } else if (methodStr.toLowerCase().includes('tarjeta')) {
        info.type = 'Tarjeta';
        info.digitalType = 'Tarjeta';
        info.digital = totalVal;
        info.cash = 0;
    } else if (methodStr.toLowerCase().includes('crédito') || methodStr.toLowerCase().includes('credito')) {
        info.type = 'Crédito';
        info.cash = 0;
        info.digital = 0;
    }

    return info;
};

const formatSaleNumber = (num) => {
    if (!num) return '00001';
    const digitsStr = String(num).replace(/\D/g, '');
    if (digitsStr) {
        return digitsStr.padStart(5, '0');
    }
    return String(num);
};

const fmtCompact = (num) => Number(num) % 1 === 0 ? Number(num).toFixed(0) : Number(num).toFixed(2);

const Ticket = forwardRef(({ sale, items, branch, customer, seller, paymentMethod, currencySymbol = 'Bs.' }, ref) => {
    if (!sale) return null

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const discount = sale.discount !== undefined ? sale.discount : 0
    const total = sale.total !== undefined ? sale.total : (subtotal - discount)
    
    // Parse payment details to separate cash vs digital
    const paymentInfo = parsePaymentDetails(paymentMethod || sale.payment_method, total)
    const isCreditSale = paymentInfo.type === 'Crédito' || sale.is_credit;

    // Compute cash net, digital, and credit amounts
    const discountVal = discount
    const digitalVal = paymentInfo.digital
    const creditVal = isCreditSale ? total : 0
    const cashNetVal = isCreditSale ? 0 : Math.max(0, total - digitalVal)

    // Format payment text
    let paymentText = '';
    if (isCreditSale) {
        paymentText = `PAGO A Crédito`;
    } else if (paymentInfo.type === 'Mixto') {
        paymentText = `PAGO Mixto ( Efectivo ${fmtCompact(paymentInfo.cash)} + ${paymentInfo.digitalType} ${fmtCompact(paymentInfo.digital)} )`;
    } else if (paymentInfo.type === 'Efectivo') {
        paymentText = `PAGO Efectivo`;
    } else {
        paymentText = `PAGO ${paymentInfo.type}`;
    }

    return (
        <div ref={ref} className="ticket-container" style={{
            width: '190mm',
            minHeight: '260mm',
            padding: '10mm 12mm',
            backgroundColor: 'white',
            color: 'black',
            fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
            fontSize: '12px',
            lineHeight: '1.4',
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
                        width: 190mm !important; 
                        height: auto;
                        padding: 10mm 12mm !important;
                        box-shadow: none !important;
                        margin: 0 auto !important;
                    }
                }
                .bw-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    margin-bottom: 15px;
                }
                .bw-table th, .bw-table td {
                    border: 1px solid black;
                    padding: 6px 10px;
                }
                .bw-table th {
                    background-color: white !important;
                    color: black;
                    font-weight: bold;
                    text-align: center;
                }
                `}
            </style>

            {/* Header section with Centered Branch Info */}
            <div style={{ display: 'flex', position: 'relative', width: '100%', marginBottom: '25px', alignItems: 'center', minHeight: '40px' }}>
                <div style={{ position: 'absolute', left: 0, display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'black', fontFamily: "'Arial', sans-serif", lineHeight: 1 }}>
                        GACIA
                    </span>
                    <svg width="10" height="15" viewBox="0 0 10 15" style={{ marginLeft: '3px', marginTop: '-8px' }}>
                        <polygon points="0,15 10,0 5,0 0,10" fill="#d91c1c" />
                    </svg>
                </div>
                
                <div style={{ margin: '0 auto', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 'bold' }}>{branch?.name || 'Casa Matriz'}</p>
                    <p style={{ margin: '0', fontSize: '13px' }}>Tel: {branch?.phone || '71522611 —71522611'}</p>
                </div>
            </div>

            {/* Customer & Document metadata */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div>
                    <p style={{ margin: '0 0 4px 0' }}><strong>Señor:</strong> {customer?.name || 'Cliente de Mostrador'}</p>
                    <p style={{ margin: '0' }}><strong>CEL/CI:</strong> {customer?.tax_id || customer?.phone || '6000000'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}><strong>COMPROBANTE N° {formatSaleNumber(sale.sale_number)}</strong></p>
                    <p style={{ margin: '0' }}>{formatSpanishDate(sale.created_at)}</p>
                </div>
            </div>

            {/* Items table */}
            <table className="bw-table">
                <thead>
                    <tr>
                        <th style={{ textAlign: 'center', width: '45%' }}>Código</th>
                        <th style={{ textAlign: 'center', width: '20%' }}>Nombre</th>
                        <th style={{ textAlign: 'center', width: '6%' }}>Cantidad</th>
                        <th style={{ textAlign: 'center', width: '14%' }}>P. Unitario</th>
                        <th style={{ textAlign: 'center', width: '15%' }}>Sub Total BS</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td style={{ textAlign: 'left' }}>{item.sku || 'N/A'}</td>
                            <td style={{ textAlign: 'left' }}>{item.name}</td>
                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>{item.price.toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                    ))}
                    <tr>
                        <td colSpan="3" style={{ border: 'none' }}></td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', border: '1px solid black' }}>TOTAL:</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', border: '1px solid black' }}>{subtotal.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            {/* Observations and Totals side by side */}
            <div style={{ marginTop: '5px', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px' }}>Ovservaciones:</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
                    {/* Left notes box */}
                    <div style={{ flex: 1, border: '1px solid black', minHeight: '80px', padding: '10px' }}>
                        {sale.notes || ''}
                    </div>
                    {/* Right summary table */}
                    <table style={{ width: '250px', borderCollapse: 'collapse', border: '1px solid black' }}>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid black' }}>
                                <td style={{ padding: '6px 10px', fontSize: '12px' }}>Descuento</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', backgroundColor: '#f2f2f2', width: '100px', fontSize: '12px' }}>{discountVal.toFixed(2)}</td>
                            </tr>
                            {isCreditSale ? (
                                <tr style={{ borderBottom: '1px solid black' }}>
                                    <td style={{ padding: '6px 10px', fontSize: '12px' }}>Crédito</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right', backgroundColor: '#f2f2f2', width: '100px', fontSize: '12px' }}>{creditVal.toFixed(2)}</td>
                                </tr>
                            ) : (
                                <tr style={{ borderBottom: '1px solid black' }}>
                                    <td style={{ padding: '6px 10px', fontSize: '12px' }}>{paymentInfo.digitalType}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right', backgroundColor: '#f2f2f2', width: '100px', fontSize: '12px' }}>{digitalVal.toFixed(2)}</td>
                                </tr>
                            )}
                            <tr>
                                <td style={{ padding: '6px 10px', fontSize: '12px' }}>Total Neto Cash</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', backgroundColor: '#f2f2f2', width: '100px', fontSize: '12px' }}>{cashNetVal.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom details block */}
            <div style={{ border: '1px solid black', display: 'flex', marginTop: '10px' }}>
                <div style={{ flex: 1, padding: '10px', borderRight: '1px solid black' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>SON: {numeroALetras(subtotal)}</p>
                    <p style={{ margin: '0', fontSize: '12px' }}>{paymentText}</p>
                </div>
                <div style={{ width: '250px' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid black' }}>
                        <div style={{ flex: 1, padding: '8px 10px', fontWeight: 'bold', fontSize: '12px' }}>TOTAL</div>
                        <div style={{ width: '100px', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>{subtotal.toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex' }}>
                        <div style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}>Cajero</div>
                        <div style={{ width: '100px', padding: '8px 10px', textAlign: 'right', fontSize: '12px' }}>{seller?.full_name || seller?.name || 'Hardy'}</div>
                    </div>
                </div>
            </div>

            {/* Credit Details section */}
            {isCreditSale && (
                <div style={{ marginTop: '25px', pageBreakInside: 'avoid' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        DETALLE DE CRÉDITO
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '11px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid black' }}>
                                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid black' }}>Fecha</th>
                                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid black' }}>Hora</th>
                                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid black' }}>Monto</th>
                                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Initial Row: The Debt itself */}
                            <tr style={{ borderBottom: '1px solid black' }}>
                                <td style={{ padding: '6px 10px', borderRight: '1px solid black' }}>{new Date(sale.created_at).toLocaleDateString()}</td>
                                <td style={{ padding: '6px 10px', borderRight: '1px solid black' }}>{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', borderRight: '1px solid black' }}>0.00 {currencySymbol}</td>
                                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>{Number(total).toFixed(2)} {currencySymbol}</td>
                            </tr>
                            
                            {/* Payment Rows */}
                            {(() => {
                                let runningBalance = Number(total)
                                const payments = sale.customer_payments || []
                                return [...payments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(p => {
                                    runningBalance -= Number(p.amount)
                                    return (
                                        <tr key={p.id} style={{ borderBottom: '1px solid black' }}>
                                            <td style={{ padding: '6px 10px', borderRight: '1px solid black' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                                            <td style={{ padding: '6px 10px', borderRight: '1px solid black' }}>{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right', borderRight: '1px solid black', color: '#10b981', fontWeight: 'bold' }}>{Number(p.amount).toFixed(2)} {currencySymbol}</td>
                                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>{runningBalance.toFixed(2)} {currencySymbol}</td>
                                        </tr>
                                    )
                                })
                            })()}
                        </tbody>
                        <tfoot>
                            <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                                <td colSpan="2" style={{ padding: '8px 10px', textAlign: 'right', borderRight: '1px solid black' }}>TOTAL PAGADO:</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', borderRight: '1px solid black', color: '#10b981' }}>
                                    {(sale.customer_payments || []).reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2)} {currencySymbol}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                    SALDO ACTUAL: {(Number(total) - (sale.customer_payments || []).reduce((acc, p) => acc + Number(p.amount), 0)).toFixed(2)} {currencySymbol}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

        </div>
    )
})

Ticket.displayName = 'Ticket'

export default Ticket
