import React, { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, Building2, User, Package, Calculator, Info, ChevronRight, Box, Printer, ClipboardList, Tag, LayoutGrid, Minus, RefreshCw, Calendar, ShoppingCart } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBranch } from '../../context/BranchContext'
import ProductGrid from './ProductGrid'

export default function QuotationModal({ quotation, onClose, onSave, isSaving, currencySymbol = 'Bs.' }) {
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [brands, setBrands] = useState([])
    const [selectedBrandId, setSelectedBrandId] = useState(null)
    const [selectedModelId, setSelectedModelId] = useState(null)
    const [models, setModels] = useState([])
    const [isBrandListOpen, setIsBrandListOpen] = useState(false)
    const [viewMode, setViewMode] = useState('list')
    const [gridRefreshKey, setGridRefreshKey] = useState(0)
    const [loading, setLoading] = useState(true)
    const [showCatalog, setShowCatalog] = useState(false)

    const { selectedBranchId } = useBranch()
    const branchId = quotation?.branch_id || selectedBranchId

    const [formData, setFormData] = useState({
        customer_id: '',
        valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE'),
        notes: '',
        discount: 0,
        tax: 0,
        subtotal: 0,
        total: 0
    })

    const [customers, setCustomers] = useState([])
    const [customerSearch, setCustomerSearch] = useState('')
    const [isCustomerListOpen, setIsCustomerListOpen] = useState(false)

    useEffect(() => {
        loadInitialData()
    }, [quotation, branchId])

    async function loadInitialData() {
        try {
            setLoading(true)
            const { data: custData } = await supabase.from('customers').select('id, name, email, phone').eq('active', true).order('name')
            setCustomers(custData || [])

            if (quotation) {
                const { data: items, error } = await supabase.from('quotation_items').select('*, products(id, name, sku, image_url, price)').eq('quotation_id', quotation.id)
                if (error) throw error
                
                const mappedItems = items.map(i => ({
                    id: i.product_id,
                    product_id: i.product_id,
                    name: i.products?.name,
                    sku: i.products?.sku,
                    image_url: i.products?.image_url,
                    price: i.price,
                    quantity: i.quantity
                }))
                setCart(mappedItems)

                setFormData({
                    customer_id: quotation.customer_id || '',
                    valid_until: quotation.valid_until || '',
                    notes: quotation.notes || '',
                    discount: quotation.discount || 0,
                    tax: quotation.tax || 0,
                    subtotal: quotation.subtotal || 0,
                    total: quotation.total || 0
                })
                setCustomerSearch(custData?.find(c => c.id === quotation.customer_id)?.name || '')
            }
            fetchBrands()
        } catch (err) {
            console.error('Error loading quotation data:', err)
        } finally {
            setLoading(false)
        }
    }

    async function fetchBrands() {
        if (!branchId) return
        try {
            const { data, error } = await supabase.from('brands').select(`id, name, products!inner(id, settings:product_branch_settings!inner(stock, branch_id))`).eq('products.settings.branch_id', branchId).gt('products.settings.stock', 0).order('name')
            if (error) throw error
            const unique = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
            setBrands(unique)
        } catch {
            const { data } = await supabase.from('brands').select('*').order('name')
            if (data) setBrands(data)
        }
    }

    async function fetchModels(brandId) {
        if (!brandId) {
            setModels([])
            return
        }
        const { data } = await supabase.from('models').select('*').eq('brand_id', brandId).order('name')
        setModels(data || [])
    }

    useEffect(() => {
        if (selectedBrandId) {
            fetchModels(selectedBrandId)
            setSelectedModelId(null)
        } else {
            setModels([])
            setSelectedModelId(null)
        }
    }, [selectedBrandId])

    const addToCart = (product, quantity = 1) => {
        setCart(prev => {
            const pid = String(product.id || product.product_id)
            const existing = prev.find(i => String(i.id || i.product_id) === pid)
            if (existing) {
                return prev.map(i => String(i.id || i.product_id) === pid ? { ...i, quantity: i.quantity + quantity } : i)
            }
            return [...prev, { ...product, id: pid, product_id: pid, quantity }]
        })
    }

    const removeFromCart = (id) => setCart(prev => prev.filter(i => String(i.id || i.product_id) !== String(id)))
    const updateQuantity = (id, delta) => setCart(prev => prev.map(i => String(i.id || i.product_id) === String(id) ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i))

    useEffect(() => {
        const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
        const discountVal = parseFloat(formData.discount || 0)
        const taxVal = parseFloat(formData.tax || 0)
        const total = Math.max(0, subtotal + taxVal - discountVal)
        setFormData(prev => ({ ...prev, subtotal, total }))
    }, [cart, formData.discount, formData.tax])

    const handleSave = () => {
        if (cart.length === 0) return alert('Agregue al menos un producto')
        onSave({ ...formData, branch_id: branchId, items: cart })
    }

    if (loading && !quotation) {
        return (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <RefreshCw size={48} className="animate-spin" color="white" />
            </div>
        )
    }

    const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()))

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '1200px', maxHeight: '95vh', padding: 0, borderRadius: '28px', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: 'hsl(var(--background))' }}>
                
                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.08)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.6rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '14px' }}><ClipboardList size={24} /></div>
                        <div>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em' }}>{quotation ? 'Editar Cotización' : 'Nueva Cotización'}</h2>
                            <p style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Gestión profesional de presupuestos y cotizaciones</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }} disabled={isSaving}><X size={22} /></button>
                </div>

                <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1.25rem' }}>
                        <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginLeft: '0.5rem', marginBottom: '0.4rem', display: 'block' }}>Cliente</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input type="text" placeholder="Buscar cliente..." value={customerSearch} onFocus={() => setIsCustomerListOpen(true)} onChange={(e) => { setCustomerSearch(e.target.value); setIsCustomerListOpen(true) }} style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', borderRadius: '16px', border: '1.5px solid hsl(var(--primary) / 0.1)', backgroundColor: 'hsl(var(--secondary) / 0.2)', fontSize: '0.95rem', fontWeight: '700', outline: 'none' }} />
                            </div>
                            {isCustomerListOpen && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 110, marginTop: '0.5rem', backgroundColor: 'white', borderRadius: '18px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid hsl(var(--border) / 0.6)', maxHeight: '200px', overflowY: 'auto' }}>
                                    {filteredCustomers.map(c => (
                                        <div key={c.id} onClick={() => { setFormData(prev => ({ ...prev, customer_id: c.id })); setCustomerSearch(c.name); setIsCustomerListOpen(false) }} style={{ padding: '0.8rem 1.25rem', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border) / 0.3)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.4)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem' }}>{c.name}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginLeft: '0.5rem', marginBottom: '0.4rem', display: 'block' }}>Válido hasta</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input type="date" value={formData.valid_until} onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))} style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', borderRadius: '16px', border: 'none', backgroundColor: 'hsl(var(--secondary) / 0.2)', fontSize: '0.95rem', fontWeight: '700', outline: 'none' }} />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginLeft: '0.5rem', marginBottom: '0.4rem', display: 'block' }}>Sucursal</label>
                            <div style={{ padding: '0.85rem 1.25rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(var(--primary))', fontWeight: '800' }}>
                                <Building2 size={18} /> {branchId === 'all' ? 'Todas' : 'Sucursal Activa'}
                            </div>
                        </div>
                    </div>

                    <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', border: '1px solid hsl(var(--border) / 0.5)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.15)' }}>
                                <tr>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.5 }}>Producto</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.5 }}>Cant.</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.5 }}>Precio</th>
                                    <th style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.5 }}>Subtotal</th>
                                    <th style={{ padding: '1rem 1.5rem', width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.length > 0 ? cart.map(item => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                    {item.image_url ? <img src={item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={20} style={{ opacity: 0.2 }} />}
                                                </div>
                                                <div>
                                                    <p style={{ margin: 0, fontWeight: '800', fontSize: '0.9rem' }}>{item.name}</p>
                                                    <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.4 }}>SKU: {item.sku || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', padding: '0.4rem', borderRadius: '12px', width: 'fit-content', margin: '0 auto' }}>
                                                <button onClick={() => updateQuantity(item.id, -1)} style={{ padding: '0.2rem', borderRadius: '6px', border: 'none', backgroundColor: 'white' }}><Minus size={14} /></button>
                                                <span style={{ fontWeight: '900', minWidth: '25px', textAlign: 'center' }}>{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} style={{ padding: '0.2rem', borderRadius: '6px', border: 'none', backgroundColor: 'white' }}><Plus size={14} /></button>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '800' }}>{currencySymbol}{Number(item.price).toFixed(2)}</td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: '900', color: 'hsl(var(--primary))' }}>{currencySymbol}{(Number(item.price) * item.quantity).toFixed(2)}</td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <button onClick={() => removeFromCart(item.id)} style={{ color: 'hsl(var(--destructive))', border: 'none', background: 'none' }}><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="5" style={{ padding: '4rem', textAlign: 'center', opacity: 0.3, fontWeight: '800' }}>No hay productos seleccionados</td></tr>
                                )}
                            </tbody>
                        </table>
                        <div style={{ padding: '1.5rem 2rem', backgroundColor: 'hsl(var(--secondary) / 0.05)', display: 'flex', justifyContent: 'flex-end', gap: '2rem', alignItems: 'center' }}>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '900', opacity: 0.4 }}>TOTAL</p>
                                <p style={{ margin: 0, fontSize: '2rem', fontWeight: '950', color: 'hsl(var(--primary))' }}>{currencySymbol}{formData.total.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button onClick={() => setShowCatalog(!showCatalog)} style={{ width: '100%', padding: '1rem', borderRadius: '20px', border: '2px dashed hsl(var(--primary) / 0.2)', backgroundColor: 'hsl(var(--primary) / 0.03)', color: 'hsl(var(--primary))', fontWeight: '900', cursor: 'pointer' }}>
                            {showCatalog ? 'OCULTAR CATÁLOGO' : 'AGREGAR PRODUCTOS DEL CATÁLOGO'}
                        </button>

                        {showCatalog && (
                            <div className="card shadow-sm" style={{ padding: '1rem', borderRadius: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <button onClick={() => setIsBrandListOpen(!isBrandListOpen)} style={{ width: '100%', padding: '0.7rem', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.5)', backgroundColor: 'white', fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{brands.find(b => b.id === selectedBrandId)?.name || 'Seleccionar Marca...'}</span>
                                            <ChevronRight size={16} />
                                        </button>
                                        {isBrandListOpen && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 120, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', padding: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                                                <div onClick={() => { setSelectedBrandId(null); setIsBrandListOpen(false) }} style={{ padding: '0.6rem', cursor: 'pointer', borderRadius: '8px', fontWeight: '700', color: 'hsl(var(--primary))' }}>Ver Todos</div>
                                                {brands.map(b => <div key={b.id} onClick={() => { setSelectedBrandId(b.id); setIsBrandListOpen(false) }} style={{ padding: '0.6rem', cursor: 'pointer', borderRadius: '8px', fontWeight: '700' }}>{b.name}</div>)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={18} style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                        <input type="text" placeholder="Buscar productos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.7rem 0.7rem 0.7rem 2.5rem', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.5)', outline: 'none', fontWeight: '700' }} />
                                    </div>
                                </div>

                                {selectedBrandId && models.length > 0 && (
                                    <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                                        <button
                                            onClick={() => setSelectedModelId(null)}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                borderRadius: '100px',
                                                border: 'none',
                                                backgroundColor: !selectedModelId ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                                                color: !selectedModelId ? 'white' : 'hsl(var(--secondary-foreground))',
                                                fontSize: '0.75rem',
                                                fontWeight: '800',
                                                whiteSpace: 'nowrap',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            TODOS
                                        </button>
                                        {models.map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => setSelectedModelId(m.id)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: '100px',
                                                    border: 'none',
                                                    backgroundColor: selectedModelId === m.id ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                                                    color: selectedModelId === m.id ? 'white' : 'hsl(var(--secondary-foreground))',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '800',
                                                    whiteSpace: 'nowrap',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {m.name.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <ProductGrid searchTerm={searchTerm} branchId={branchId} brandId={selectedBrandId} modelId={selectedModelId} onAddToCart={addToCart} currencySymbol={currencySymbol} viewMode="grid" stockFilter="in-stock" />
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={onClose} className="btn" style={{ padding: '0.85rem 2rem', borderRadius: '16px' }}>Cancelar</button>
                    <button onClick={handleSave} className="btn btn-primary" style={{ padding: '0.85rem 3rem', borderRadius: '16px', fontWeight: '900' }} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" /> : 'Guardar Cotización'}
                    </button>
                </div>
            </div>
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        </div>
    )
}
