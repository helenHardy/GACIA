import React, { useState, useEffect, useRef } from 'react'
import { Search, ShoppingCart, Trash2, Wallet, Banknote, QrCode, Building2, Printer, CheckCircle, X, Tag, ChevronRight, Layers, LayoutGrid, RefreshCw, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ProductGrid from '../components/pos/ProductGrid'
import Cart from '../components/pos/Cart'
import CheckoutModal from '../components/pos/CheckoutModal'
import Ticket from '../components/pos/Ticket'

export default function POS() {
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [branches, setBranches] = useState([])
    const [selectedBranchId, setSelectedBranchId] = useState(null)
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('Efectivo')
    const [lastSale, setLastSale] = useState(null)
    const [showTicket, setShowTicket] = useState(false)
    const [categories, setCategories] = useState(['Todos'])
    const [selectedCategory, setSelectedCategory] = useState('Todos')
    const [taxSettings, setTaxSettings] = useState({ enable_tax: true, tax_rate: 13, tax_name: 'IVA' })
    const [currencySymbol, setCurrencySymbol] = useState('Bs.')
    const [gridRefreshKey, setGridRefreshKey] = useState(0)
    const [viewMode, setViewMode] = useState('list') // 'grid' or 'list'
    const ticketRef = useRef()

    useEffect(() => {
        fetchBranches()
        fetchCategories()
        fetchSettings()
    }, [])

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

    async function fetchCategories() {
        const { data } = await supabase.from('categories').select('name').order('name')
        if (data) setCategories(['Todos', ...data.map(c => c.name)])
    }

    async function fetchBranches() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        const isAdmin = profile?.role === 'Administrador'
        let query = supabase.from('branches').select('*').eq('active', true).order('name')
        if (!isAdmin) {
            const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
            const assignedIds = assignments?.map(a => a.branch_id) || []
            if (assignedIds.length > 0) query = query.in('id', assignedIds)
            else return setBranches([])
        }
        const { data } = await query
        if (data && data.length > 0) {
            setBranches(data)
            setSelectedBranchId(data[0].id)
        }
    }

    const addToCart = (product) => {
        const availableStock = product.stock || 0
        if (availableStock <= 0) {
            alert(`El producto ${product.name} está agotado.`)
            return
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id)
            if (existing) {
                if (existing.quantity + 1 > availableStock) {
                    alert(`No hay suficiente stock para añadir más de ${product.name}. Stock disponible: ${availableStock}`)
                    return prev
                }
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                )
            }
            return [...prev, { ...product, quantity: 1 }]
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

    const handleCheckout = async (checkoutData) => {
        try {
            if (!selectedBranchId) return alert('Seleccione una sucursal')
            setIsProcessing(true)
            const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
            const tax = taxSettings.enable_tax ? (subtotal * (taxSettings.tax_rate / 100)) : 0
            const discount = checkoutData?.discount || 0
            const total = Math.max(0, subtotal + tax - discount)

            const { data: { user } } = await supabase.auth.getUser()
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert([{
                    subtotal, tax, total,
                    discount: discount,
                    payment_method: checkoutData?.paymentMethod,
                    amount_received: checkoutData?.isCredit ? 0 : (checkoutData?.amountPaid || total),
                    amount_change: checkoutData?.isCredit ? 0 : (checkoutData?.change || 0),
                    branch_id: selectedBranchId,
                    customer_id: checkoutData?.customerId || null,
                    is_credit: checkoutData?.isCredit || false,
                    user_id: user?.id
                }])
                .select().single()
            if (saleError) throw saleError
            const { error: itemsError } = await supabase
                .from('sale_items')
                .insert(cart.map(item => ({
                    sale_id: sale.id, product_id: item.id,
                    quantity: item.quantity, price: item.price, total: item.price * item.quantity
                })))
            if (itemsError) throw itemsError

            // ELIMINADO: La actualización manual del saldo del cliente.
            // Ahora se encarga el trigger trg_sales_credit en la base de datos de forma automática y segura.

            setLastSale({ sale, items: [...cart], branch: branches.find(b => b.id === selectedBranchId), customer: checkoutData?.customer || null, paymentMethod: checkoutData?.paymentMethod, currencySymbol })
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

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const total = taxSettings.enable_tax ? (subtotal * (1 + (taxSettings.tax_rate / 100))) : subtotal

    return (
        <div className="no-scrollbar" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 420px',
            gap: '1.5rem',
            minHeight: '100vh',
            padding: '1rem',
            alignItems: 'start'
        }}>
            {isCheckoutOpen && (
                <CheckoutModal
                    total={total}
                    isProcessing={isProcessing}
                    currencySymbol={currencySymbol}
                    onClose={() => setIsCheckoutOpen(false)}
                    onConfirm={handleCheckout}
                />
            )}

            {showTicket && lastSale && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', maxWidth: '400px', width: '100%' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 36%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}><CheckCircle size={40} /></div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>¡Venta Exitosa!</h2>
                            <p style={{ opacity: 0.6 }}>Comprobante generado correctamente.</p>
                        </div>
                        <div className="card shadow-2xl" style={{ backgroundColor: 'white', padding: 0, borderRadius: '20px', overflow: 'hidden', width: '100%' }}>
                            <Ticket ref={ticketRef} {...lastSale} />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                            <button className="btn" style={{ flex: 1, borderRadius: '14px', backgroundColor: 'white' }} onClick={() => setShowTicket(false)}><X size={20} /> Cerrar</button>
                            <button className="btn btn-primary" style={{ flex: 1, borderRadius: '14px' }} onClick={handlePrint}><Printer size={20} /> Imprimir</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Catalog Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid hsl(var(--border) / 0.6)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                            <input
                                type="text"
                                placeholder="Buscar productos por nombre, SKU o marca..."
                                style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontSize: '0.95rem', outline: 'none' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', gap: '0.75rem' }}>
                            <Building2 size={18} opacity={0.5} />
                            <select
                                style={{ background: 'transparent', border: 'none', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
                                value={selectedBranchId || ''}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>

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

                    <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '0.6rem 1.25rem',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    whiteSpace: 'nowrap',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    backgroundColor: selectedCategory === cat ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                                    color: selectedCategory === cat ? 'white' : 'hsl(var(--foreground))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {cat === 'Todos' ? <LayoutGrid size={14} /> : <Tag size={14} />}
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="no-scrollbar" style={{ paddingRight: '0.5rem' }}>
                    <ProductGrid
                        searchTerm={searchTerm}
                        branchId={selectedBranchId}
                        category={selectedCategory}
                        onAddToCart={addToCart}
                        currencySymbol={currencySymbol}
                        refreshKey={gridRefreshKey}
                        viewMode={viewMode}
                    />
                </div>
            </div>

            {/* Sidebar Cart - Sticky */}
            <div className="card shadow-md no-scrollbar" style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                borderRadius: '24px',
                overflow: 'hidden',
                border: '1px solid hsl(var(--border) / 0.6)',
                backgroundColor: 'hsl(var(--background))',
                position: 'sticky',
                top: '1rem',
                maxHeight: 'calc(100vh - 2rem)'
            }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}><ShoppingCart size={20} /></div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: '800' }}>Orden Actual</h2>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', backgroundColor: 'hsl(var(--primary))', color: 'white', padding: '4px 10px', borderRadius: '99px' }}>{cart.length} ITEMS</span>
                </div>

                <div className="no-scrollbar" style={{ flex: 1, overflowY: 'scroll', paddingRight: '0.25rem' }}>
                    <Cart items={cart} onRemove={removeFromCart} onUpdateQuantity={updateQuantity} currencySymbol={currencySymbol} />
                </div>

                <div style={{ padding: '1.75rem', backgroundColor: 'hsl(var(--secondary) / 0.15)', borderTop: '1px solid hsl(var(--border) / 0.4)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', opacity: 0.6, fontWeight: '600' }}>
                            <span>Subtotal</span>
                            <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                        </div>
                        {taxSettings.enable_tax && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', opacity: 0.6, fontWeight: '600' }}>
                                <span>{taxSettings.tax_name} ({taxSettings.tax_rate}%)</span>
                                <span>{currencySymbol}{(subtotal * (taxSettings.tax_rate / 100)).toFixed(2)}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: '700' }}>Total a Pagar</span>
                            <span style={{ fontSize: '1.75rem', fontWeight: '900', color: 'hsl(var(--primary))', letterSpacing: '-0.02em' }}>{currencySymbol}{total.toFixed(2)}</span>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary shadow-xl shadow-primary/20"
                        style={{ width: '100%', padding: '1.15rem', borderRadius: '18px', fontSize: '1.1rem', fontWeight: '800', gap: '0.75rem' }}
                        onClick={() => setIsCheckoutOpen(true)}
                        disabled={cart.length === 0 || isProcessing}
                    >
                        {isProcessing ? <><RefreshCw className="animate-spin" /> PROCESANDO...</> : <><Wallet /> COBRAR ORDEN</>}
                    </button>

                    <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', opacity: 0.4, fontWeight: '600' }}>
                        SISTEMA DE FACTURACIÓN POS v2.0
                    </p>
                </div>
            </div>
        </div>
    )
}
