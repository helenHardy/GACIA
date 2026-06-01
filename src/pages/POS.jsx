import React, { useState, useEffect, useRef } from 'react'
import { Search, ShoppingCart, Trash2, Wallet, Banknote, QrCode, Building2, Printer, CheckCircle, X, Tag, ChevronRight, Layers, LayoutGrid, RefreshCw, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ProductGrid from '../components/pos/ProductGrid'
import Cart from '../components/pos/Cart'
import CheckoutModal from '../components/pos/CheckoutModal'
import Ticket from '../components/pos/Ticket'
import { useBranch } from '../context/BranchContext'
import html2pdf from 'html2pdf.js'

export default function POS() {
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('Efectivo')
    const [lastSale, setLastSale] = useState(null)
    const [showTicket, setShowTicket] = useState(false)
    const [brands, setBrands] = useState([])
    const [selectedBrandId, setSelectedBrandId] = useState(null)
    const [selectedModelId, setSelectedModelId] = useState(null)
    const [taxSettings, setTaxSettings] = useState({ enable_tax: true, tax_rate: 13, tax_name: 'IVA' })
    const [currencySymbol, setCurrencySymbol] = useState('Bs.')
    const [gridRefreshKey, setGridRefreshKey] = useState(0)
    const [viewMode, setViewMode] = useState('list') // 'grid' or 'list'
    const [stockFilter, setStockFilter] = useState('in-stock') 
    const [models, setModels] = useState([])
    const [isBrandListOpen, setIsBrandListOpen] = useState(false)
    const { selectedBranchId, branches } = useBranch()
    const ticketRef = useRef()

    useEffect(() => {
        fetchSettings()
        fetchModels()
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
        if (!selectedBranchId || selectedBranchId === 'all') {
            setBrands([])
            return
        }

        try {
            // Obtener todas las marcas que tienen productos con stock en esta sucursal
            const { data, error } = await supabase
                .from('brands')
                .select(`
                    id,
                    name,
                    products!inner(
                        id,
                        settings:product_branch_settings!inner(stock, branch_id)
                    )
                `)
                .eq('products.settings.branch_id', selectedBranchId)
                .gt('products.settings.stock', 0)
                .order('name')

            if (error) throw error
            
            const uniqueBrands = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
            setBrands(uniqueBrands)
        } catch (err) {
            console.error('Error fetching brands for POS:', err)
            const { data } = await supabase.from('brands').select('*').order('name')
            if (data) setBrands(data)
        }
    }

    const addToCart = (product, quantity = 1) => {
        const availableStock = product.stock || 0
        if (availableStock <= 0) {
            alert(`El producto ${product.name} está agotado.`)
            return
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id)
            if (existing) {
                const totalQty = existing.quantity + quantity
                if (totalQty > availableStock) {
                    alert(`No hay suficiente stock. Disponible: ${availableStock}`)
                    return prev
                }
                return prev.map(item => item.id === product.id ? { ...item, quantity: totalQty } : item)
            }
            return [...prev, { ...product, quantity }]
        })
    }

    const removeFromCart = (productId) => setCart(prev => prev.filter(item => item.id !== productId))
    const updateQuantity = (productId, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQuantity = Math.max(1, item.quantity + delta)
                const availableStock = item.stock || 0

                if (delta > 0 && newQuantity > availableStock) {
                    alert(`Solo hay ${availableStock} unidades disponibles de ${item.name}.`)
                    return item
                }
                return { ...item, quantity: newQuantity }
            }
            return item
        }))
    }

    const setQuantity = (productId, newQuantity) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const availableStock = item.stock || 0
                // Permitimos 0 temporalmente para que el usuario pueda borrar y escribir
                const qty = Math.max(0, newQuantity)

                if (qty > availableStock) {
                    alert(`Solo hay ${availableStock} unidades disponibles de ${item.name}.`)
                    return { ...item, quantity: availableStock }
                }
                return { ...item, quantity: qty }
            }
            return item
        }))
    }

    const setPrice = (productId, newPrice) => {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                return { ...item, price: Math.max(0, newPrice) }
            }
            return item
        }))
    }

    const handleCheckout = async (checkoutData) => {
        try {
            if (!selectedBranchId || selectedBranchId === 'all') return alert('Seleccione una sucursal específica para vender.')
            setIsProcessing(true)
            const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
            const tax = taxSettings.enable_tax ? (subtotal * (taxSettings.tax_rate / 100)) : 0
            const discount = checkoutData?.discount || 0
            const total = Math.max(0, subtotal + tax - discount)

            const branchIdNum = Number(selectedBranchId)
            const customerIdNum = checkoutData?.customerId ? Number(checkoutData?.customerId) : null

            const { data: { user } } = await supabase.auth.getUser()
            
            const rpcArgs = {
                p_items: cart.map(item => ({ product_id: Number(item.id), quantity: item.quantity, price: item.price })),
                p_subtotal: subtotal,
                p_tax: tax,
                p_total: total,
                p_discount: discount,
                p_payment_method: checkoutData?.paymentMethod,
                p_amount_received: checkoutData?.isCredit ? 0 : (checkoutData?.amountPaid || total),
                p_amount_change: checkoutData?.isCredit ? 0 : (checkoutData?.change || 0),
                p_branch_id: branchIdNum,
                p_customer_id: customerIdNum,
                p_is_credit: checkoutData?.isCredit || false,
                p_user_id: String(checkoutData?.sellerId || user?.id || ""),
                p_notes: checkoutData?.notes || ''
            }

            console.log('Registrando venta con parámetros:', rpcArgs)

            const { data: sale, error: saleError } = await supabase.rpc('register_sale_v3', rpcArgs)
            if (saleError) throw saleError

            // ELIMINADO: La actualización manual del saldo del cliente.
            // Ahora se encarga el trigger trg_sales_credit en la base de datos de forma automática y segura.

            setLastSale({ 
                sale, 
                items: [...cart], 
                branch: branches.find(b => Number(b.id) === branchIdNum), 
                customer: checkoutData?.customer || null, 
                seller: checkoutData?.seller || null,
                paymentMethod: checkoutData?.paymentMethod, 
                currencySymbol 
            })
            setShowTicket(true)
            setCart([])
            setIsCheckoutOpen(false)
            setGridRefreshKey(prev => prev + 1)
        } catch (err) {
            console.error(err)
            alert('Error al registrar venta: ' + err.message)
        } finally {
            setIsProcessing(false)
        }
    }

    const handlePrint = () => {
        const printArea = ticketRef.current.innerHTML
        const printWindow = window.open('', '_blank', 'width=800,height=600')
        printWindow.document.write(`<html><head><title>Ticket</title><style>body{margin:0;padding:0;}</style></head><body>${printArea}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script></body></html>`)
        printWindow.document.close()
    }

    const handleDownloadPdf = () => {
        if (!ticketRef.current) return;
        
        const opt = {
            margin:       [5, 5, 5, 5],
            filename:     `Comprobante_${lastSale?.sale?.sale_number || 'venta'}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(ticketRef.current).save();
    }

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const total = taxSettings.enable_tax ? (subtotal * (1 + (taxSettings.tax_rate / 100))) : subtotal

    return (
        <div className="no-scrollbar" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            minHeight: '100vh',
            padding: '1rem',
            maxWidth: '1200px',
            margin: '0 auto'
        }}>


            {showTicket && lastSale && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', maxWidth: '700px', width: '100%', animation: 'zoomIn 0.3s ease-out' }}>
                        
                        <div style={{ 
                            backgroundColor: 'white', 
                            borderRadius: '28px', 
                            overflow: 'hidden', 
                            width: '100%', 
                            boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.6)',
                            maxHeight: '70vh',
                            display: 'flex',
                            flexDirection: 'column',
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#142 76% 36%' }}>
                                    <CheckCircle size={20} color="#22c55e" />
                                    <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Venta Exitosa</span>
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', opacity: 0.5 }}>Comprobante #{lastSale.sale?.sale_number || '---'}</span>
                            </div>

                            <div style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', justifyContent: 'center', backgroundColor: '#f1f1f1' }}>
                                <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', width: '100%', display: 'flex', justifyContent: 'center' }}>
                                    <Ticket ref={ticketRef} {...lastSale} />
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '0.75rem', width: '100%' }}>
                            <button 
                                className="btn-hover" 
                                style={{ padding: '0.85rem', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer' }} 
                                onClick={() => setShowTicket(false)}
                            >
                                CERRAR
                            </button>
                            <button 
                                className="btn-hover" 
                                style={{ padding: '0.85rem', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} 
                                onClick={handleDownloadPdf}
                            >
                                <Printer size={18} /> PDF
                            </button>
                            <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.85rem', borderRadius: '16px', fontWeight: '900', fontSize: '0.9rem', boxShadow: '0 10px 20px -5px rgb(var(--primary) / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} 
                                onClick={handlePrint}
                            >
                                <Printer size={20} /> IMPRIMIR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Catalog Selectors Section (Modified to match Transfers) */}
            <div className="card shadow-sm" style={{ padding: '1.5rem 2rem', borderRadius: '24px', border: '1px solid hsl(var(--border) / 0.6)', display: 'grid', gridTemplateColumns: '1.5fr 2fr', gap: '1.5rem', position: 'relative', zIndex: 100 }}>
                {/* Brand Selector */}
                <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.6rem', display: 'block' }}>Marca (Buscador)</label>
                    <button 
                        onClick={() => setIsBrandListOpen(!isBrandListOpen)}
                        style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid hsl(var(--primary) / 0.1)', backgroundColor: 'hsl(var(--secondary) / 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem', outline: 'none' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Tag size={18} style={{ opacity: 0.3 }} />
                            <span>{!selectedBrandId ? 'Seleccionar Marca' : brands.find(b => b.id === selectedBrandId)?.name || 'Seleccione marca...'}</span>
                        </div>
                        <ChevronRight size={18} style={{ transform: isBrandListOpen ? 'rotate(90deg)' : 'none', transition: '0.2s', opacity: 0.3 }} />
                    </button>

                    {isBrandListOpen && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid hsl(var(--border) / 0.6)', maxHeight: '300px', overflowY: 'auto', zIndex: 150, padding: '0.5rem' }}>
                            {brands.map(b => (
                                <div 
                                    key={b.id}
                                    onClick={() => { setSelectedBrandId(b.id); setIsBrandListOpen(false); }}
                                    style={{ padding: '0.8rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', color: selectedBrandId === b.id ? 'hsl(var(--primary))' : 'inherit', backgroundColor: selectedBrandId === b.id ? 'hsl(var(--primary) / 0.05)' : 'transparent', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                                >
                                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'hsl(var(--secondary) / 0.5)', overflow: 'hidden' }}>
                                        {b.logo_url && <img src={b.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                    </div>
                                    {b.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Searcher */}
                <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.6rem', display: 'block' }}>Buscar productos</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                        <input 
                            type="text" 
                            placeholder="Nombre, SKU o código..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3rem', borderRadius: '12px', border: '1.5px solid hsl(var(--primary) / 0.1)', backgroundColor: 'hsl(var(--secondary) / 0.2)', fontSize: '0.95rem', fontWeight: '700', outline: 'none' }}
                        />
                    </div>
                </div>
            </div>

            {/* Level 2: Product Lines (Models) Selector Bar */}
            {selectedBrandId && (
                <div style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    overflowX: 'auto', 
                    padding: '0.5rem 0', 
                    marginBottom: '0.5rem',
                    msOverflowStyle: 'none', 
                    scrollbarWidth: 'none',
                    animation: 'fadeInDown 0.3s ease-out'
                }}>
                    <button 
                        onClick={() => setSelectedModelId(null)}
                        style={{
                            padding: '0.4rem 1.25rem',
                            borderRadius: '100px',
                            backgroundColor: !selectedModelId ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                            color: !selectedModelId ? 'white' : 'inherit',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Todos
                    </button>
                    {models.filter(m => m.brand_id === selectedBrandId).map(m => (
                        <button 
                            key={m.id}
                            onClick={() => setSelectedModelId(m.id)}
                            style={{
                                padding: '0.4rem 1.25rem',
                                borderRadius: '100px',
                                backgroundColor: selectedModelId === m.id ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.2)',
                                color: selectedModelId === m.id ? 'white' : 'inherit',
                                border: 'none',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {m.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Catalog Results Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '2px', backgroundColor: 'hsl(var(--secondary) / 0.4)', padding: '4px', borderRadius: '12px' }}>
                        <button
                            onClick={() => setViewMode('list')}
                            className="btn-icon"
                            title="Vista de Lista"
                            style={{
                                padding: '6px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: viewMode === 'list' ? 'hsl(var(--background))' : 'transparent',
                                color: viewMode === 'list' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.4)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            <ClipboardList size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className="btn-icon"
                            title="Vista de Cuadrícula"
                            style={{
                                padding: '6px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: viewMode === 'grid' ? 'hsl(var(--background))' : 'transparent',
                                color: viewMode === 'grid' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.4)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: viewMode === 'grid' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            <LayoutGrid size={20} />
                        </button>
                    </div>

                    <button
                        onClick={() => setGridRefreshKey(prev => prev + 1)}
                        className="btn"
                        style={{ padding: '0.5rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.4)' }}
                        title="Actualizar Catálogo"
                    >
                        <RefreshCw size={20} opacity={0.5} />
                    </button>
                </div>

                <div className="no-scrollbar" onClick={() => setIsBrandListOpen(false)}>
                    <ProductGrid
                        searchTerm={searchTerm}
                        branchId={selectedBranchId}
                        brandId={selectedBrandId}
                        modelId={selectedModelId}
                        onAddToCart={addToCart}
                        currencySymbol={currencySymbol}
                        refreshKey={gridRefreshKey}
                        viewMode={viewMode}
                        stockFilter={stockFilter}
                        excludeIds={cart.map(item => item.id)}
                    />
                </div>
            </div>

            {/* Bottom Cart Section (Like Transfers) */}
            <div className="card shadow-lg" style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                borderRadius: '24px',
                overflow: 'hidden',
                border: '1px solid hsl(var(--border) / 0.6)',
                backgroundColor: 'hsl(var(--background))',
                marginTop: '1rem'
            }}>
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}><ShoppingCart size={20} /></div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: '800' }}>Orden Actual</h2>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', backgroundColor: 'hsl(var(--primary))', color: 'white', padding: '4px 12px', borderRadius: '99px' }}>{cart.length} PRODUCTOS</span>
                </div>

                <div className="no-scrollbar" style={{ overflowY: 'visible' }}>
                    <Cart
                        items={cart}
                        onRemove={removeFromCart}
                        onUpdateQuantity={updateQuantity}
                        onSetQuantity={setQuantity}
                        onSetPrice={setPrice}
                        currencySymbol={currencySymbol}
                    />
                </div>

                <div style={{ padding: '1.5rem 2rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderTop: '2px dashed hsl(var(--border) / 0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
                        <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase' }}>Subtotal</p>
                                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>{currencySymbol}{subtotal.toFixed(2)}</p>
                            </div>
                            {taxSettings.enable_tax && (
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase' }}>{taxSettings.tax_name} ({taxSettings.tax_rate}%)</p>
                                    <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>{currencySymbol}{(subtotal * (taxSettings.tax_rate / 100)).toFixed(2)}</p>
                                </div>
                            )}
                            <div style={{ backgroundColor: 'white', padding: '0.75rem 1.5rem', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.4)' }}>
                                <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '900', opacity: 0.4, textTransform: 'uppercase' }}>Total a Pagar</p>
                                <p style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--primary))', letterSpacing: '-0.03em' }}>{currencySymbol}{total.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {cart.length > 0 && (
                <CheckoutModal
                    inline={true}
                    total={total}
                    isProcessing={isProcessing}
                    currencySymbol={currencySymbol}
                    branchId={selectedBranchId}
                    onClose={() => setCart([])}
                    onConfirm={handleCheckout}
                />
            )}
        </div>
    )
}
