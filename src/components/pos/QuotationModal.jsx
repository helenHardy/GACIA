import React, { useState, useEffect } from 'react'
import {
    X,
    Search,
    Plus,
    Trash2,
    Save,
    User,
    Building2,
    Package,
    ShoppingCart,
    Calculator,
    ClipboardList,
    Printer,
    CheckCircle,
    RefreshCw,
    LayoutGrid,
    List as ListIcon,
    ChevronRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ProductGrid from './ProductGrid'

export default function QuotationModal({ quotation, isSaving, onClose, onSave, currencySymbol = 'Bs.' }) {
    const [branches, setBranches] = useState([])
    const [customers, setCustomers] = useState([])
    const [products, setProducts] = useState([])
    const [items, setItems] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [customerSearch, setCustomerSearch] = useState('')
    const [showCustomerList, setShowCustomerList] = useState(false)
    const [showProductList, setShowProductList] = useState(false)
    const [selectedBrandId, setSelectedBrandId] = useState('all')
    const [brands, setBrands] = useState([])
    const [gridRefreshKey, setGridRefreshKey] = useState(0)
    const [viewMode, setViewMode] = useState('list')

    const [formData, setFormData] = useState({
        customer_id: '',
        branch_id: '',
        notes: '',
        discount: 0,
        tax: 0,
        valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 15 days default
    })
    const [step, setStep] = useState(1)

    const [selectedCustomer, setSelectedCustomer] = useState(null)

    useEffect(() => {
        fetchInitialData()
        if (quotation) {
            loadQuotationData()
        }
    }, [quotation])

    async function fetchInitialData() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Get branch assignments
        const { data: assignments } = await supabase
            .from('user_branches')
            .select('branch_id')
            .eq('user_id', user.id)

        const assignedIds = assignments?.map(a => a.branch_id) || []

        // 2. Fetch branches
        let query = supabase.from('branches').select('*').eq('active', true).order('name')
        if (assignedIds.length > 0) {
            query = query.in('id', assignedIds)
        }

        const { data: bData } = await query
        setBranches(bData || [])

        if (bData?.length > 0 && !quotation) {
            setFormData(prev => ({ ...prev, branch_id: bData[0].id }))
        }

        const { data: cData } = await supabase.from('customers').select('*').eq('active', true).order('name')
        setCustomers(cData || [])

        const targetBranchId = quotation?.branch_id || assignedIds[0] || bData[0]?.id
        if (targetBranchId) {
            const { data: brandsData } = await supabase.rpc('get_active_brands_with_stock', { p_branch_id: targetBranchId })
            setBrands(brandsData || [])
        }
    }

    async function loadQuotationData() {
        setFormData({
            customer_id: quotation.customer_id,
            branch_id: quotation.branch_id,
            notes: quotation.notes || '',
            discount: quotation.discount || 0,
            tax: quotation.tax || 0,
            valid_until: quotation.valid_until || ''
        })
        setSelectedCustomer(quotation.customers)

        // Fetch items and their current stock
        const { data: itemsData } = await supabase
            .from('quotation_items')
            .select('*, products(name, sku, brand, model)')
            .eq('quotation_id', quotation.id)

        if (itemsData && itemsData.length > 0) {
            const productIds = itemsData.map(i => i.product_id)
            const { data: stockData } = await supabase
                .from('product_branch_settings')
                .select('product_id, stock')
                .in('product_id', productIds)
                .eq('branch_id', quotation.branch_id)

            const stockMap = {}
            stockData?.forEach(s => stockMap[s.product_id] = s.stock)

            setItems(itemsData.map(item => ({
                product_id: item.product_id,
                name: item.products.name,
                sku: item.products.sku,
                brand: item.products.brand,
                model: item.products.model,
                quantity: item.quantity,
                price: item.price,
                stock: stockMap[item.product_id] || 0
            })))
        }
    }

    const searchProducts = async (term) => {
        if (!term || !formData.branch_id) {
            setProducts([])
            return
        }
        const { data } = await supabase
            .from('products')
            .select(`
                *,
                settings:product_branch_settings!inner(stock)
            `)
            .eq('active', true)
            .eq('settings.branch_id', formData.branch_id)
            .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
            .limit(10)

        const mapped = data?.map(p => ({
            ...p,
            stock: p.settings[0]?.stock || 0
        }))

        setProducts(mapped || [])
        setShowProductList(true)
    }

    const addItem = (product, quantity = 1) => {
        const existing = items.find(i => i.product_id === product.id)
        if (existing) {
            setItems(items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + quantity } : i))
        } else {
            setItems([...items, {
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                quantity: quantity,
                price: product.price,
                stock: product.stock
            }])
        }
    }

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const updateItem = (index, field, value) => {
        const newItems = [...items]
        const newValue = parseFloat(value) || 0

        if (field === 'quantity') {
            const availableStock = newItems[index].stock || 0
            if (newValue > availableStock) {
                alert(`Solo hay ${availableStock} unidades disponibles de este producto.`)
                newItems[index][field] = availableStock
            } else {
                // Permitimos 0 temporalmente para borrar/escribir
                newItems[index][field] = Math.max(0, newValue)
            }
        } else {
            newItems[index][field] = Math.max(0, newValue)
        }

        setItems(newItems)
    }

    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const discount = parseFloat(formData.discount || 0)
    const tax = parseFloat(formData.tax || 0)
    const total = Math.max(0, subtotal + tax - discount)

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.tax_id?.toLowerCase().includes(customerSearch.toLowerCase())
    )

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '1280px', height: '92vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '24px', overflow: 'hidden', backgroundColor: 'hsl(var(--background))' }}>

                {/* Header */}
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.6rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}>
                            <ClipboardList size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                                {quotation ? `Editar Cotización #${quotation.quotation_number}` : 'Nueva Cotización'}
                            </h2>
                            <p style={{ fontSize: '0.8rem', opacity: 0.5, margin: 0 }}>Gestión de presupuestos profesionales</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }}><X size={20} /></button>
                </div>

                {/* Progress Indicator */}
                <div style={{ display: 'flex', padding: '0.75rem 2rem', backgroundColor: 'white', borderBottom: '1px solid hsl(var(--border) / 0.4)', gap: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step === 1 ? 1 : 0.5 }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: step === 1 ? 'hsl(var(--primary))' : 'hsl(var(--secondary))', color: step === 1 ? 'white' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900' }}>1</div>
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seleccionar Productos</span>
                    </div>
                    <div style={{ width: '40px', height: '1px', backgroundColor: 'hsl(var(--border) / 0.4)', alignSelf: 'center' }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: step === 2 ? 1 : 0.5 }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: step === 2 ? 'hsl(var(--primary))' : 'hsl(var(--secondary))', color: step === 2 ? 'white' : 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '900' }}>2</div>
                        <span style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Finalizar Cotización</span>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: step === 1 ? '1fr' : '1fr', overflow: 'hidden' }}>
                    {/* Step 1: Items & Selection */}
                    {step === 1 && (
                        <div className="no-scrollbar" style={{ padding: '1.5rem 2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Brand & Search Selectors (POS Style) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Marca</label>
                                <select
                                    style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: '16px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    value={selectedBrandId}
                                    onChange={(e) => setSelectedBrandId(e.target.value)}
                                >
                                    <option value="all">Seleccionar Marca...</option>
                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Buscar Producto</label>
                                <div style={{ position: 'relative' }}>
                                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                    <input
                                        type="text"
                                        placeholder="Nombre, SKU o código..."
                                        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: '16px', border: 'none', fontSize: '0.95rem', fontWeight: '600' }}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '0.25rem', borderRadius: '12px', gap: '0.25rem' }}>
                                <button onClick={() => setViewMode('grid')} style={{ padding: '0.6rem', borderRadius: '10px', border: 'none', backgroundColor: viewMode === 'grid' ? 'white' : 'transparent', color: viewMode === 'grid' ? 'hsl(var(--primary))' : 'inherit', cursor: 'pointer' }}><LayoutGrid size={18} /></button>
                                <button onClick={() => setViewMode('list')} style={{ padding: '0.6rem', borderRadius: '10px', border: 'none', backgroundColor: viewMode === 'list' ? 'white' : 'transparent', color: viewMode === 'list' ? 'hsl(var(--primary))' : 'inherit', cursor: 'pointer' }}><ListIcon size={18} /></button>
                            </div>
                        </div>

                        {/* Product Catalog Grid/List */}
                        <div style={{ height: '350px', overflowY: 'auto', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.4)', padding: '1rem' }} className="no-scrollbar">
                            <ProductGrid
                                searchTerm={searchTerm}
                                branchId={formData.branch_id}
                                brandId={selectedBrandId}
                                onAddToCart={addItem}
                                currencySymbol={currencySymbol}
                                refreshKey={gridRefreshKey}
                                viewMode={viewMode}
                                excludeIds={items.map(i => i.product_id)}
                            />
                        </div>

                        {/* Items Table */}
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Detalle de Cotización</label>
                            <div className="card shadow-inner" style={{ padding: 0, borderRadius: '18px', backgroundColor: 'hsl(var(--secondary) / 0.2)', border: 'none', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                                        <tr>
                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.7rem' }}>Item</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.7rem' }}>Cant.</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.7rem' }}>Precio</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.7rem' }}>Subtotal</th>
                                            <th style={{ padding: '1rem', width: '40px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', opacity: 0.3 }}>
                                                    <Package size={32} style={{ margin: '0 auto 0.5rem' }} />
                                                    <p style={{ fontSize: '0.85rem', fontWeight: '700' }}>Sin productos seleccionados</p>
                                                </td>
                                            </tr>
                                         ) : (
                                            items.map((item, index) => (
                                                <tr key={index} style={{ borderBottom: '1px solid hsl(var(--border) / 0.2)' }}>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{item.name}</span>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{item.sku}</span>
                                                                <span style={{
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: '800',
                                                                    color: (item.stock || 0) > 0 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))'
                                                                }}>
                                                                    Stock: {item.stock || 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <input
                                                            type="number"
                                                            className="btn"
                                                            style={{
                                                                width: '60px',
                                                                padding: '0.4rem',
                                                                textAlign: 'center',
                                                                backgroundColor: 'white',
                                                                borderRadius: '8px',
                                                                fontWeight: '800'
                                                            }}
                                                            value={item.quantity === 0 ? '' : item.quantity}
                                                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                            onFocus={(e) => e.target.select()}
                                                            onBlur={() => { if (item.quantity === 0) updateItem(index, 'quantity', 1) }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        <input
                                                            type="number"
                                                            className="btn"
                                                            style={{
                                                                width: '80px',
                                                                padding: '0.4rem',
                                                                textAlign: 'right',
                                                                backgroundColor: 'white',
                                                                borderRadius: '8px',
                                                                fontWeight: '800'
                                                            }}
                                                            value={item.price === 0 ? '' : item.price}
                                                            onChange={(e) => updateItem(index, 'price', e.target.value)}
                                                            onFocus={(e) => e.target.select()}
                                                            onBlur={() => { if (item.price === 0) updateItem(index, 'price', 0) }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', fontSize: '0.9rem' }}>
                                                        {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <button onClick={() => removeItem(index)} style={{ color: 'hsl(var(--destructive))', padding: '0.25rem' }} className="btn hover:bg-destructive/10"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Step 1 Footer */}
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div style={{ color: 'hsl(var(--primary))', fontWeight: '900', fontSize: '1.2rem' }}>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase', display: 'block' }}>Subtotal</span>
                                    {currencySymbol}{subtotal.toFixed(2)}
                                </div>
                                <div style={{ color: 'hsl(var(--primary))', fontWeight: '900', fontSize: '1.2rem' }}>
                                    <span style={{ fontSize: '0.8rem', opacity: 0.5, textTransform: 'uppercase', display: 'block' }}>Items</span>
                                    {items.length}
                                </div>
                            </div>
                            <button 
                                onClick={() => setStep(2)} 
                                disabled={items.length === 0}
                                className="btn btn-primary" 
                                style={{ padding: '1rem 3rem', borderRadius: '16px', fontWeight: '900', fontSize: '1rem', gap: '0.75rem' }}
                            >
                                CONTINUAR A PASO 2 <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                    )}

                    {/* Step 2: Customer & Summary */}
                    {step === 2 && (
                        <div className="no-scrollbar" style={{ padding: '2rem 4rem', backgroundColor: 'hsl(var(--secondary) / 0.05)', display: 'flex', justifyContent: 'center', overflowY: 'auto' }}>
                            <div style={{ maxWidth: '700px', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                    {/* Customer Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginLeft: '0.5rem' }}>Cliente</label>
                                        {!selectedCustomer ? (
                                            <div style={{ position: 'relative' }}>
                                                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar cliente..."
                                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', backgroundColor: 'white', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.95rem', fontWeight: '600' }}
                                                    value={customerSearch}
                                                    onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerList(true); }}
                                                    onFocus={() => setShowCustomerList(true)}
                                                />
                                                {showCustomerList && (
                                                    <div className="card shadow-xl" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem', borderRadius: '14px' }}>
                                                        {filteredCustomers.map(c => (
                                                            <div
                                                                key={c.id}
                                                                onClick={() => { setSelectedCustomer(c); setFormData(prev => ({ ...prev, customer_id: c.id })); setShowCustomerList(false); }}
                                                                style={{ padding: '0.75rem 1rem', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', flexDirection: 'column' }}
                                                                className="hover:bg-secondary/50"
                                                            >
                                                                <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{c.name}</span>
                                                                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{c.tax_id || 'Sin NIT/CI'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} /></div>
                                                    <div>
                                                        <p style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>{selectedCustomer.name}</p>
                                                        <p style={{ fontSize: '0.75rem', fontWeight: '700', margin: 0, opacity: 0.6 }}>NIT/CI: {selectedCustomer.tax_id || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => { setSelectedCustomer(null); setFormData(prev => ({ ...prev, customer_id: '' })); }} className="btn" style={{ fontSize: '0.75rem', fontWeight: '900', color: 'hsl(var(--destructive))' }}>CAMBIAR</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Config Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginLeft: '0.5rem' }}>Configuración</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <select
                                                style={{ width: '100%', padding: '1rem', backgroundColor: 'white', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
                                                value={formData.branch_id}
                                                onChange={(e) => setFormData(prev => ({ ...prev, branch_id: e.target.value }))}
                                            >
                                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                            <input
                                                type="date"
                                                style={{ width: '100%', padding: '1rem', backgroundColor: 'white', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
                                                value={formData.valid_until}
                                                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginLeft: '0.5rem' }}>Ajustes de Precio</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                                                <input
                                                    type="number"
                                                    placeholder="Descuento"
                                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.2rem', backgroundColor: 'white', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.95rem', fontWeight: '700' }}
                                                    value={formData.discount}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                                                />
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                                                <input
                                                    type="number"
                                                    placeholder="Impuestos"
                                                    style={{ width: '100%', padding: '1rem 1rem 1rem 2.2rem', backgroundColor: 'white', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.95rem', fontWeight: '700' }}
                                                    value={formData.tax}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, tax: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginLeft: '0.5rem' }}>Notas</label>
                                        <textarea
                                            placeholder="Información adicional..."
                                            style={{ width: '100%', padding: '1rem', backgroundColor: 'white', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.9rem', fontWeight: '600', resize: 'none', height: '52px' }}
                                            value={formData.notes}
                                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Final Summary Card */}
                                <div className="card shadow-xl" style={{ padding: '2.5rem', borderRadius: '32px', backgroundColor: 'white', border: '1px solid hsl(var(--border) / 0.4)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6, fontWeight: '700', fontSize: '1rem' }}>
                                        <span>Subtotal por {items.length} productos</span>
                                        <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6, fontWeight: '700', fontSize: '1rem' }}>
                                        <span>Impuestos Aplicados</span>
                                        <span>{currencySymbol}{tax.toFixed(2)}</span>
                                    </div>
                                    {discount > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--destructive))', fontWeight: '700', fontSize: '1rem' }}>
                                            <span>Descuento Especial</span>
                                            <span>-{currencySymbol}{discount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <hr style={{ border: 'none', height: '2px', backgroundColor: 'hsl(var(--border) / 0.2)', margin: '0.5rem 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: '900', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>TOTAL COTIZADO</span>
                                        <span style={{ fontWeight: '900', fontSize: '3rem', color: 'hsl(var(--primary))', letterSpacing: '-0.04em' }}>{currencySymbol}{total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
                                    <button 
                                        onClick={() => setStep(1)} 
                                        className="btn" 
                                        style={{ flex: 1, padding: '1.25rem', borderRadius: '20px', backgroundColor: 'white', border: '1px solid hsl(var(--border))', fontWeight: '800', gap: '0.5rem' }}
                                    >
                                        <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /> VOLVER A PRODUCTOS
                                    </button>
                                    <button
                                        onClick={() => onSave(formData, items)}
                                        disabled={isSaving || !formData.customer_id}
                                        className="btn btn-primary"
                                        style={{ flex: 1.5, padding: '1.25rem', borderRadius: '20px', fontWeight: '900', fontSize: '1.1rem', gap: '0.75rem', boxShadow: '0 20px 40px -10px hsl(var(--primary) / 0.4)' }}
                                    >
                                        {isSaving ? <RefreshCw className="animate-spin" /> : <Save />}
                                        {quotation ? 'ACTUALIZAR COTIZACIÓN' : 'FINALIZAR Y GUARDAR'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
