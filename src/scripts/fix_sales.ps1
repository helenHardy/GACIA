$path = 'c:\Users\Dev\Desktop\gacia\src\pages\Sales.jsx'
$content = Get-Content $path
$head = $content[0..1139] 
$tail = @"

            </div>

            {/* Modal de Pago Parcial */}
            {paymentModalOpen && selectedSaleForPayment && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '2rem' }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'hsl(var(--foreground))' }}>Registrar Pago</h3>
                            <button onClick={() => setPaymentModalOpen(false)} style={{ opacity: 0.5 }}><X size={24} /></button>
                        </div>
                        
                        <div style={{ marginBottom: '1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '1.25rem', borderRadius: '16px' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.6, fontWeight: '700' }}>TICKET #{selectedSaleForPayment.sale_number}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                                <span style={{ fontWeight: '700' }}>Total:</span>
                                <span style={{ fontWeight: '800' }}>{currencySymbol}{selectedSaleForPayment.total.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--destructive))', marginTop: '0.25rem' }}>
                                <span style={{ fontWeight: '700' }}>Saldo Pendiente:</span>
                                <span style={{ fontWeight: '900' }}>
                                    {currencySymbol}{(selectedSaleForPayment.total - (selectedSaleForPayment.customer_payments?.reduce((acc, p) => acc + p.amount, 0) || 0)).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', opacity: 0.5, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Monto a Pagar</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '900', opacity: 0.3 }}>{currencySymbol}</span>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="0.00"
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.5rem', borderRadius: '14px', border: '2px solid hsl(var(--border))', fontWeight: '900', fontSize: '1.25rem' }}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleRegisterPayment}
                            disabled={loading || !paymentAmount}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '1rem', borderRadius: '14px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                        >
                            <Plus size={20} />
                            Confirmar Pago
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden Ticket reference for printing */}
            <div style={{ display: 'none' }}>
                {saleForTicket && (
                    <Ticket
                        ref={ticketRef}
                        sale={saleForTicket.sale}
                        items={saleForTicket.items}
                        branch={saleForTicket.branch}
                        customer={saleForTicket.customer}
                        paymentMethod={saleForTicket.paymentMethod}
                        currencySymbol={saleForTicket.currencySymbol}
                    />
                )}
            </div>
        </div>
    )
}
"@
$newContent = $head + $tail
Set-Content $path -Value $newContent -Encoding UTF8
