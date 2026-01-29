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
    RefreshCw
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function QuotationModal({ quotation, isSaving, onClose, onSave, currencySymbol = 'Bs.' }) {
    const [branches, setBranches] = useState([])
    const [customers, setCustomers] = useState([])
    const [products, setProducts] = useState([])
    const [items, setItems] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [customerSearch, setCustomerSearch] = useState('')
    const [showCustomerList, setShowCustomerList] = useState(false)
    const [showProductList, setShowProductList] = useState(false)

    const [formData, setFormData] = useState({
        customer_id: '',
        branch_id: '',
        notes: '',
        discount: 0,
        tax: 0,
        valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 15 days default
    })

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

        // Fetch items
        const { data: itemsData } = await supabase
            .from('quotation_items')
            .select('*, products(name, sku)')
            .eq('quotation_id', quotation.id)

        if (itemsData) {
            setItems(itemsData.map(item => ({
                product_id: item.product_id,
                name: item.products.name,
                sku: item.products.sku,
                quantity: item.quantity,
                price: item.price
            })))
        }
    }

    const searchProducts = async (term) => {
        if (!term) {
            setProducts([])
            return
        }
        const { data } = await supabase
            .from('products')
            .select('*')
            .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
            .limit(10)
        setProducts(data || [])
        setShowProductList(true)
    }

    const addItem = (product) => {
        const existing = items.find(i => i.product_id === product.id)
        if (existing) {
            setItems(items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
        } else {
            setItems([...items, {
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                quantity: 1,
                price: product.price
            }])
        }
        setSearchTerm('')
        setShowProductList(false)
    }

    const removeItem = (index) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const updateItem = (index, field, value) => {
        const newItems = [...items]
        newItems[index][field] = parseFloat(value) || 0
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
            <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '1000px', height: '90vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '24px', overflow: 'hidden', backgroundColor: 'hsl(var(--background))' }}>

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

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', overflow: 'hidden' }}>
                    {/* Left side: Items & Selection */}
                    <div style={{ padding: '2rem', borderRight: '1px solid hsl(var(--border) / 0.5)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Product Search */}
                        <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Agregar Productos</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o SKU..."
                                    style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', borderRadius: '16px', border: 'none', fontSize: '0.95rem', fontWeight: '600' }}
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); searchProducts(e.target.value); }}
                                    onFocus={() => setShowProductList(true)}
                                />
                            </div>

                            {showProductList && products.length > 0 && (
                                <div className="card shadow-xl" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '0.5rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem', borderRadius: '16px' }}>
                                    {products.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => addItem(p)}
                                            style={{ padding: '0.85rem 1rem', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' }}
                                            className="hover:bg-secondary/50"
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{p.name}</span>
                                                <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>SKU: {p.sku}</span>
                                            </div>
                                            <span style={{ fontWeight: '800', color: 'hsl(var(--primary))' }}>{currencySymbol} {p.price}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                                            <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{item.sku}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <input
                                                            type="number"
                                                            className="btn"
                                                            style={{ width: '60px', padding: '0.4rem', textAlign: 'center', backgroundColor: 'white', borderRadius: '8px', fontWeight: '800' }}
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        <input
                                                            type="number"
                                                            className="btn"
                                                            style={{ width: '80px', padding: '0.4rem', textAlign: 'right', backgroundColor: 'white', borderRadius: '8px', fontWeight: '800' }}
                                                            value={item.price}
                                                            onChange={(e) => updateItem(index, 'price', e.target.value)}
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
                    </div>

                    {/* Right side: Customer & Summary */}
                    <div style={{ padding: '2rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>

                        {/* Customer Section */}
                        <div style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Cliente</label>
                            {!selectedCustomer ? (
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                    <input
                                        type="text"
                                        placeholder="Buscar o seleccionar cliente..."
                                        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', backgroundColor: 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.9rem', fontWeight: '600' }}
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
                                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} /></div>
                                        <div>
                                            <p style={{ fontSize: '0.9rem', fontWeight: '800', margin: 0 }}>{selectedCustomer.name}</p>
                                            <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: 0 }}>{selectedCustomer.tax_id || 'Sin NIT/CI'}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => { setSelectedCustomer(null); setFormData(prev => ({ ...prev, customer_id: '' })); }} className="btn" style={{ fontSize: '0.7rem', fontWeight: '800', color: 'hsl(var(--destructive))' }}>CAMBIAR</button>
                                </div>
                            )}
                        </div>

                        {/* Config Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Sucursal</label>
                                <select
                                    style={{ width: '100%', padding: '0.85rem', backgroundColor: 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
                                    value={formData.branch_id}
                                    onChange={(e) => setFormData(prev => ({ ...prev, branch_id: e.target.value }))}
                                >
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Validez</label>
                                <input
                                    type="date"
                                    style={{ width: '100%', padding: '0.85rem', backgroundColor: 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
                                    value={formData.valid_until}
                                    onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Descuento Total</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        style={{ width: '100%', padding: '0.85rem 0.85rem 0.85rem 2rem', backgroundColor: 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
                                        value={formData.discount}
                                        onChange={(e) => setFormData(prev => ({ ...prev, discount: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Impuestos</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        style={{ width: '100%', padding: '0.85rem 0.85rem 0.85rem 2rem', backgroundColor: 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
                                        value={formData.tax}
                                        onChange={(e) => setFormData(prev => ({ ...prev, tax: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', marginLeft: '0.5rem' }}>Notas Internas</label>
                            <textarea
                                placeholder="Ej: Precio especial por volumen..."
                                style={{ width: '100%', padding: '1rem', backgroundColor: 'white', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.9rem', fontWeight: '600', resize: 'none', height: '60px' }}
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            />
                        </div>

                        {/* Summary */}
                        <div style={{ marginTop: 'auto', padding: '1.5rem', backgroundColor: 'white', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.5)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.5, fontWeight: '700', fontSize: '0.85rem' }}>
                                <span>Subtotal</span>
                                <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                            </div>
                            {tax > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.5, fontWeight: '700', fontSize: '0.85rem' }}>
                                    <span>Impuestos (+)</span>
                                    <span>{currencySymbol}{tax.toFixed(2)}</span>
                                </div>
                            )}
                            {discount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--destructive))', fontWeight: '700', fontSize: '0.85rem' }}>
                                    <span>Descuento (-)</span>
                                    <span>-{currencySymbol}{discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div style={{ height: '1px', backgroundColor: 'hsl(var(--border) / 0.3)', margin: '0.25rem 0' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <span style={{ fontWeight: '800', fontSize: '1rem' }}>TOTAL</span>
                                <span style={{ fontWeight: '900', fontSize: '1.75rem', color: 'hsl(var(--primary))', letterSpacing: '-0.02em' }}>{currencySymbol}{total.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => onSave(formData, items)}
                            disabled={isSaving || items.length === 0}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '1.25rem', borderRadius: '18px', fontWeight: '800', fontSize: '1rem', gap: '0.75rem', boxShadow: '0 10px 20px -5px hsl(var(--primary) / 0.3)' }}
                        >
                            {isSaving ? <RefreshCw className="animate-spin" /> : <Save />}
                            {quotation ? 'ACTUALIZAR COTIZACIÓN' : 'GUARDAR COTIZACIÓN'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
