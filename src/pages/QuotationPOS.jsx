import React, { useState, useEffect, useRef } from 'react'
import { Search, ShoppingCart, Trash2, Wallet, Building2, Printer, CheckCircle, X, Tag, ChevronRight, Layers, LayoutGrid, RefreshCw, ClipboardList, FileText, Calendar, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ProductGrid from '../components/pos/ProductGrid'
import Cart from '../components/pos/Cart'
import { useBranch } from '../context/BranchContext'

export default function QuotationPOS() {
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [lastQuotation, setLastQuotation] = useState(null)
    const [showSuccess, setShowSuccess] = useState(false)
    const [brands, setBrands] = useState([])
    const [selectedBrandId, setSelectedBrandId] = useState(null)
    const [selectedModelId, setSelectedModelId] = useState(null)
    const [taxSettings, setTaxSettings] = useState({ enable_tax: true, tax_rate: 13, tax_name: 'IVA' })
    const [currencySymbol, setCurrencySymbol] = useState('Bs.')
    const [gridRefreshKey, setGridRefreshKey] = useState(0)
    const [viewMode, setViewMode] = useState('list') 
    const [models, setModels] = useState([])
    const [isBrandListOpen, setIsBrandListOpen] = useState(false)
    
    const [customers, setCustomers] = useState([])
    const [customerSearch, setCustomerSearch] = useState('')
    const [isCustomerListOpen, setIsCustomerListOpen] = useState(false)
    const [selectedCustomerId, setSelectedCustomerId] = useState(null)
    const [validUntil, setValidUntil] = useState(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE'))
    const [notes, setNotes] = useState('')

    const { selectedBranchId, branches } = useBranch()

    useEffect(() => {
        fetchSettings()
        fetchModels()
        fetchCustomers()
    }, [])

    useEffect(() => {
        if (selectedBranchId) {
            fetchBrands()
        }
    }, [selectedBranchId])

    async function fetchSettings() {
        const { data } = await supabase.from('settings').select('*')
        let taxConfig = { enable_tax: true, tax_rate: 13, tax_name: 'IVA' }
        let symbol = 'Bs.'

        if (data) {
            const mapped = {}
            data.forEach(item => {
                if (item.value === 'true') mapped[item.key] = true
                else if (item.value === 'false') mapped[item.key] = false
                else mapped[item.key] = item.value
            })
            taxConfig = {
                enable_tax: mapped.enable_tax !== undefined ? mapped.enable_tax : true,
                tax_rate: mapped.tax_rate !== undefined ? parseFloat(mapped.tax_rate) : 13,
                tax_name: mapped.tax_name || 'IVA'
            }
            if (mapped.currency === 'BOL') symbol = 'Bs.'
            else if (mapped.currency === 'EUR') symbol = '€'
            else if (mapped.currency === 'USD') symbol = '$'
        }
        setTaxSettings(taxConfig)
        setCurrencySymbol(symbol)
    }

    async function fetchModels() {
        const { data } = await supabase.from('models').select('*').order('name')
        if (data) setModels(data)
    }

    async function fetchBrands() {
        if (!selectedBranchId || selectedBranchId === 'all') return
        const { data } = await supabase.from('brands').select(`id, name, products!inner(id, settings:product_branch_settings!inner(stock, branch_id))`).eq('products.settings.branch_id', selectedBranchId).gt('products.settings.stock', 0).order('name')
        if (data) {
            const uniqueBrands = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
            setBrands(uniqueBrands)
        }
    }

    async function fetchCustomers() {
        const { data } = await supabase.from('customers').select('*').eq('active', true).order('name')
        if (data) setCustomers(data)
    }

    const addToCart = (product, quantity = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id)
            if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item)
            return [...prev, { ...product, quantity }]
        })
    }

    const removeFromCart = (productId) => setCart(prev => prev.filter(item => item.id !== productId))
    const updateQuantity = (productId, delta) => setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))

    const handlePrint = async (quotationInput) => {
        try {
            if (!quotationInput) return alert('No hay datos de cotización para imprimir')
            setIsProcessing(true)
            
            // Asegurarnos de tener el objeto completo de la cotización
            let quotation = quotationInput
            if (typeof quotationInput === 'string' || typeof quotationInput === 'number' || !quotationInput.quotation_number) {
                const qId = quotationInput.id || quotationInput
                const { data: fullQ, error: qErr } = await supabase.from('quotations').select('*').eq('id', qId).single()
                if (qErr) throw qErr
                quotation = fullQ
            }

            const { data: qItems, error } = await supabase
                .from('quotation_items')
                .select('*, products(name, sku, brands(name), models(name))')
                .eq('quotation_id', quotation.id)

            if (error) throw error

            const printWindow = window.open('', '_blank', 'width=900,height=800')
            if (!printWindow) {
                alert('Por favor, permite las ventanas emergentes para imprimir.')
                return
            }

            const styles = `
                @page { size: A4; margin: 2cm; }
                body { font-family: 'Inter', sans-serif; color: #333; line-height: 1.5; font-size: 12px; }
                .header { display: flex; justify-content: space-between; margin-bottom: 2rem; border-bottom: 2px solid #eee; padding-bottom: 1rem; }
                .company-info h1 { margin: 0; color: #111; font-size: 24px; text-transform: uppercase; letter-spacing: -0.5px; }
                .company-info p { margin: 2px 0; color: #666; }
                .invoice-details { text-align: right; }
                .invoice-details h2 { margin: 0; font-size: 18px; color: #111; }
                .invoice-details p { margin: 2px 0; color: #666; }
                .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #999; margin-bottom: 0.5rem; letter-spacing: 1px; }
                .customer-box { background: #f9fafb; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
                .customer-box h3 { margin: 0 0 0.5rem 0; font-size: 14px; color: #111; }
                .customer-box p { margin: 2px 0; color: #555; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                th { text-align: left; padding: 0.75rem 0; border-bottom: 1px solid #ddd; font-weight: 700; color: #555; font-size: 10px; text-transform: uppercase; }
                td { padding: 0.75rem 0; border-bottom: 1px solid #eee; color: #111; }
                .text-right { text-align: right; }
                .totals { display: flex; justify-content: flex-end; }
                .totals-box { width: 250px; }
                .totals-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #eee; }
                .totals-row.final { border-bottom: none; border-top: 2px solid #111; margin-top: 0.5rem; padding-top: 1rem; }
                .totals-row span:first-child { color: #666; font-weight: 600; }
                .totals-row.final span { font-size: 16px; font-weight: 900; color: #111; }
                .footer { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #eee; display: flex; justify-content: space-between; color: #888; font-size: 10px; }
                .notes { flex: 2; padding-right: 2rem; }
                .signature { flex: 1; text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; }
            `

            // Obtener info del cliente para el reporte
            const customer = customers.find(c => c.id === quotation.customer_id)
            const branch = branches.find(b => b.id === quotation.branch_id)

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Cotización #${quotation.quotation_number}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap" rel="stylesheet">
                    <style>${styles}</style>
                </head>
                <body>
                    <div class="header">
                        <div class="company-info">
                            <h1>Gacia Store</h1>
                            <p>${branch?.name || 'Sucursal Principal'}</p>
                            <p>Cotización Generada por Sistema</p>
                        </div>
                        <div class="invoice-details">
                            <h2>COTIZACIÓN</h2>
                            <p style="font-size: 14px; font-weight: 700; color: #111;">#${quotation.quotation_number}</p>
                            <p>Fecha: ${new Date(quotation.created_at).toLocaleDateString()}</p>
                            <p>Válido hasta: ${new Date(quotation.valid_until).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div class="customer-box">
                        <div class="section-title">Cliente</div>
                        <h3>${customer?.name || 'Cliente General'}</h3>
                        <p>NIT/CI: ${customer?.tax_id || 'S/N'}</p>
                        ${customer?.email ? `<p>Email: ${customer.email}</p>` : ''}
                        ${customer?.phone ? `<p>Tel: ${customer.phone}</p>` : ''}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 50%;">Descripción</th>
                                <th class="text-right">Cantidad</th>
                                <th class="text-right">Precio Unit.</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${qItems.map(item => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 600;">${item.products?.name || 'Producto'}</div>
                                        <div style="color: #666; font-size: 10px;">
                                            ${item.products?.brands?.name ? `Marca: ${item.products.brands.name} | ` : ''}
                                            ${item.products?.models?.name ? `Modelo: ${item.products.models.name} | ` : ''}
                                            sku: ${item.products?.sku || ''}
                                        </div>
                                    </td>
                                    <td class="text-right">${item.quantity}</td>
                                    <td class="text-right">${currencySymbol}${item.price.toFixed(2)}</td>
                                    <td class="text-right" style="font-weight: 700;">${currencySymbol}${item.total.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="totals">
                        <div class="totals-box">
                            <div class="totals-row">
                                <span>Subtotal</span>
                                <span>${currencySymbol}${quotation.subtotal.toFixed(2)}</span>
                            </div>
                            ${quotation.tax > 0 ? `
                                <div class="totals-row">
                                    <span>Impuestos (+)</span>
                                    <span>${currencySymbol}${quotation.tax.toFixed(2)}</span>
                                </div>
                            ` : ''}
                            ${quotation.discount > 0 ? `
                                <div class="totals-row" style="color: #ef4444;">
                                    <span>Descuento (-)</span>
                                    <span>-${currencySymbol}${quotation.discount.toFixed(2)}</span>
                                </div>
                            ` : ''}
                            <div class="totals-row final">
                                <span>TOTAL</span>
                                <span>${currencySymbol}${quotation.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <div class="notes">
                            <div class="section-title">Notas / Condiciones</div>
                            <p>${quotation.notes || 'Esta cotización es válida por 15 días. Precios sujetos a cambios sin previo aviso.'}</p>
                        </div>
                        <div class="signature">
                            Firma Autorizada
                        </div>
                    </div>

                    <script>
                        window.onload = function() { window.print(); window.onafterprint = function() { window.close(); } }
                    </script>
                </body>
                </html>
            `

            printWindow.document.write(html)
            printWindow.document.close()

        } catch (err) {
            console.error('Error printing quotation:', err)
            alert('Error al imprimir cotización')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSaveQuotation = async () => {
        if (!selectedCustomerId) return alert('Por favor seleccione un cliente')
        if (cart.length === 0) return alert('El carrito está vacío')
        
        try {
            setIsProcessing(true)
            const { data: { user } } = await supabase.auth.getUser()
            
            const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
            const tax = taxSettings.enable_tax ? (subtotal * (taxSettings.tax_rate / 100)) : 0
            const total = subtotal + tax

            const { data, error } = await supabase.rpc('register_quotation_v2', {
                p_quotation_id: null,
                p_items: cart.map(item => ({ product_id: Number(item.id), quantity: item.quantity, price: item.price })),
                p_customer_id: selectedCustomerId,
                p_branch_id: Number(selectedBranchId),
                p_user_id: user?.id,
                p_subtotal: subtotal,
                p_tax: tax,
                p_discount: 0,
                p_total: total,
                p_valid_until: validUntil,
                p_notes: notes,
                p_status: 'Pendiente'
            })

            if (error) throw error

            setLastQuotation(data)
            setShowSuccess(true)
            setCart([])
            setIsCheckoutOpen(false)
            setSelectedCustomerId(null)
            setCustomerSearch('')
            setNotes('')
        } catch (err) {
            console.error(err)
            alert('Error al guardar cotización: ' + err.message)
        } finally {
            setIsProcessing(false)
        }
    }

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const total = taxSettings.enable_tax ? (subtotal * (1 + (taxSettings.tax_rate / 100))) : subtotal

    return (
        <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '100vh', padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
            
            {isCheckoutOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' }}>
                    <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '28px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>Finalizar Cotización</h2>
                            <button onClick={() => setIsCheckoutOpen(false)} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }}><X size={24} /></button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ position: 'relative' }}>
                                <label style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', display: 'block' }}>Cliente</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                    <input type="text" placeholder="Buscar cliente..." value={customerSearch} onFocus={() => setIsCustomerListOpen(true)} onChange={(e) => { setCustomerSearch(e.target.value); setIsCustomerListOpen(true) }} style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', borderRadius: '16px', border: '1.5px solid hsl(var(--primary) / 0.1)', backgroundColor: 'hsl(var(--secondary) / 0.2)', fontSize: '0.95rem', fontWeight: '700', outline: 'none' }} />
                                </div>
                                {isCustomerListOpen && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 110, marginTop: '0.5rem', backgroundColor: 'white', borderRadius: '18px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid hsl(var(--border) / 0.6)', maxHeight: '200px', overflowY: 'auto' }}>
                                        {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                                            <div key={c.id} onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); setIsCustomerListOpen(false) }} style={{ padding: '0.8rem 1.25rem', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border) / 0.3)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.4)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem' }}>{c.name}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', display: 'block' }}>Válido hasta</label>
                                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={{ width: '100%', padding: '0.85rem 1.25rem', borderRadius: '16px', border: 'none', backgroundColor: 'hsl(var(--secondary) / 0.2)', fontSize: '0.95rem', fontWeight: '700', outline: 'none' }} />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', display: 'block' }}>Notas</label>
                                <textarea placeholder="Opcional..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: '0.85rem 1.25rem', borderRadius: '16px', border: 'none', backgroundColor: 'hsl(var(--secondary) / 0.2)', fontSize: '0.95rem', fontWeight: '700', outline: 'none', minHeight: '100px', resize: 'none' }} />
                            </div>

                            <button className="btn btn-primary" onClick={handleSaveQuotation} disabled={isProcessing} style={{ padding: '1rem', borderRadius: '18px', fontWeight: '900', marginTop: '1rem' }}>
                                {isProcessing ? <RefreshCw className="animate-spin" /> : 'GENERAR COTIZACIÓN'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSuccess && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '2rem' }}>
                    <div style={{ textAlign: 'center', color: 'white', maxWidth: '400px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#4ade80', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 0 20px rgba(74, 222, 128, 0.4)' }}><CheckCircle size={40} /></div>
                        <h2 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.5rem' }}>¡Cotización Lista!</h2>
                        <p style={{ opacity: 0.8, fontSize: '1.1rem', marginBottom: '2rem' }}>La cotización se ha registrado correctamente y está lista para ser entregada.</p>
                        
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ flex: 1, padding: '1rem', borderRadius: '18px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontWeight: '800' }} onClick={() => setShowSuccess(false)}>Cerrar</button>
                            <button className="btn btn-primary" style={{ flex: 1, padding: '1rem', borderRadius: '18px', fontWeight: '900', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }} onClick={() => handlePrint(lastQuotation)}>
                                <Printer size={20} /> IMPRIMIR PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card shadow-sm" style={{ padding: '1.5rem 2rem', borderRadius: '24px', border: '1px solid hsl(var(--border) / 0.6)', display: 'grid', gridTemplateColumns: '1.5fr 2fr', gap: '1.5rem', position: 'relative', zIndex: 100 }}>
                <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.6rem', display: 'block' }}>Marca</label>
                    <button onClick={() => setIsBrandListOpen(!isBrandListOpen)} style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid hsl(var(--primary) / 0.1)', backgroundColor: 'hsl(var(--secondary) / 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem', outline: 'none' }}>
                        <span>{!selectedBrandId ? 'Seleccionar Marca' : brands.find(b => b.id === selectedBrandId)?.name || 'Seleccione...'}</span>
                        <ChevronRight size={18} style={{ transform: isBrandListOpen ? 'rotate(90deg)' : 'none', transition: '0.2s', opacity: 0.3 }} />
                    </button>
                    {isBrandListOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid hsl(var(--border) / 0.6)', maxHeight: '300px', overflowY: 'auto', zIndex: 150, padding: '0.5rem' }}>
                            <div onClick={() => { setSelectedBrandId(null); setIsBrandListOpen(false) }} style={{ padding: '0.8rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>Ver Todos</div>
                            {brands.map(b => <div key={b.id} onClick={() => { setSelectedBrandId(b.id); setIsBrandListOpen(false) }} style={{ padding: '0.8rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem' }}>{b.name}</div>)}
                        </div>
                    )}
                </div>
                <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.6rem', display: 'block' }}>Buscar productos</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                        <input type="text" placeholder="Nombre, SKU o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3rem', borderRadius: '12px', border: '1.5px solid hsl(var(--primary) / 0.1)', backgroundColor: 'hsl(var(--secondary) / 0.2)', fontSize: '0.95rem', fontWeight: '700', outline: 'none' }} />
                    </div>
                </div>
            </div>

            {selectedBrandId && (
                <div className="no-scrollbar" style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', padding: '0.5rem 0' }}>
                    <button onClick={() => setSelectedModelId(null)} style={{ padding: '0.4rem 1.25rem', borderRadius: '100px', backgroundColor: !selectedModelId ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)', color: !selectedModelId ? 'white' : 'inherit', border: 'none', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap' }}>TODOS</button>
                    {models.filter(m => m.brand_id === selectedBrandId).map(m => (
                        <button key={m.id} onClick={() => setSelectedModelId(m.id)} style={{ padding: '0.4rem 1.25rem', borderRadius: '100px', backgroundColor: selectedModelId === m.id ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.2)', color: selectedModelId === m.id ? 'white' : 'inherit', border: 'none', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>{m.name.toUpperCase()}</button>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '2px', backgroundColor: 'hsl(var(--secondary) / 0.4)', padding: '4px', borderRadius: '12px' }}>
                    <button onClick={() => setViewMode('list')} className="btn-icon" style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: viewMode === 'list' ? 'white' : 'transparent', color: viewMode === 'list' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.4)' }}><ClipboardList size={20} /></button>
                    <button onClick={() => setViewMode('grid')} className="btn-icon" style={{ padding: '6px', borderRadius: '8px', border: 'none', backgroundColor: viewMode === 'grid' ? 'white' : 'transparent', color: viewMode === 'grid' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.4)' }}><LayoutGrid size={20} /></button>
                </div>
            </div>

            <ProductGrid searchTerm={searchTerm} branchId={selectedBranchId} brandId={selectedBrandId} modelId={selectedModelId} onAddToCart={addToCart} currencySymbol={currencySymbol} refreshKey={gridRefreshKey} viewMode={viewMode} stockFilter="all" />

            <div className="card shadow-lg" style={{ display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'hsl(var(--background))', marginTop: 'auto' }}>
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}><ShoppingCart size={20} /></div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: '800' }}>Nueva Cotización</h2>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', backgroundColor: 'hsl(var(--primary))', color: 'white', padding: '4px 12px', borderRadius: '99px' }}>{cart.length} PRODUCTOS</span>
                </div>

                <Cart items={cart} onRemove={removeFromCart} onUpdateQuantity={updateQuantity} currencySymbol={currencySymbol} />

                <div style={{ padding: '1.5rem 2rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderTop: '2px dashed hsl(var(--border) / 0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '900', opacity: 0.4, textTransform: 'uppercase' }}>Total Cotizado</p>
                            <p style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--primary))' }}>{currencySymbol}{total.toFixed(2)}</p>
                        </div>
                        <button className="btn btn-primary" style={{ padding: '1rem 3rem', borderRadius: '18px', fontSize: '1.2rem', fontWeight: '900' }} onClick={() => setIsCheckoutOpen(true)} disabled={cart.length === 0 || isProcessing}>
                            {isProcessing ? <RefreshCw className="animate-spin" /> : 'GENERAR COTIZACIÓN'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
