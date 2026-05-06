import React, { useState, useEffect } from 'react'
import { X, Save, Loader2, ShoppingCart, Search, Tag, ChevronRight, RefreshCw, ClipboardList, LayoutGrid, Trash2, Plus, Minus, Box, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ProductGrid from './ProductGrid'

export default function EditSaleModal({ sale, onClose, onSave, isSaving, currencySymbol = 'Bs.' }) {
    const [cart, setCart] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [brands, setBrands] = useState([{ id: 'all', name: 'Todos' }])
    const [selectedBrandId, setSelectedBrandId] = useState('all')
    const [isBrandListOpen, setIsBrandListOpen] = useState(false)
    const [viewMode, setViewMode] = useState('list')
    const [gridRefreshKey, setGridRefreshKey] = useState(0)
    const [loading, setLoading] = useState(true)
    const [showCatalog, setShowCatalog] = useState(false)

    const branchId = sale?.branch_id

    useEffect(() => {
        async function loadSaleItems() {
            try {
                setLoading(true)
                const { data: items, error } = await supabase
                    .from('sale_items')
                    .select('*, products(id, name, sku, image_url, price, brand_id)')
                    .eq('sale_id', sale.id)
                if (error) throw error
                // Merge items by product_id (in case of duplicates from previous saves)
                const merged = {}
                items.forEach(i => {
                    const pid = String(i.product_id)
                    if (merged[pid]) {
                        merged[pid].quantity += i.quantity
                    } else {
                        merged[pid] = {
                            id: i.product_id, name: i.products?.name, sku: i.products?.sku,
                            image_url: i.products?.image_url, price: i.price, quantity: i.quantity,
                            stock: 9999, product_id: i.product_id
                        }
                    }
                })
                setCart(Object.values(merged))
            } catch (err) { console.error(err) }
            finally { setLoading(false) }
        }
        if (sale) { loadSaleItems(); fetchBrands() }
    }, [sale])

    async function fetchBrands() {
        if (!branchId) return
        try {
            // Fetch brand_ids that have products with stock in this branch
            const { data: stockData, error: stockError } = await supabase
                .from('product_branch_settings')
                .select('products!inner(brand_id)')
                .eq('branch_id', branchId)
                .gt('stock', 0)
            
            if (stockError) throw stockError
            
            const brandIds = [...new Set(stockData?.map(s => s.products?.brand_id).filter(Boolean))]
            
            if (brandIds.length === 0) {
                setBrands([{ id: 'all', name: 'Todos' }])
                return
            }

            const { data, error } = await supabase
                .from('brands')
                .select('*')
                .in('id', brandIds)
                .order('name')
            
            if (error) throw error
            setBrands([{ id: 'all', name: 'Todos' }, ...data])
        } catch (err) {
            console.error('Error fetching brands:', err)
            const { data } = await supabase.from('brands').select('*').order('name')
            if (data) setBrands([{ id: 'all', name: 'Todos' }, ...data])
        }
    }

    const addToCart = (product, quantity = 1) => {
        setCart(prev => {
            const ex = prev.find(i => String(i.id) === String(product.id))
            if (ex) return prev.map(i => String(i.id) === String(product.id) ? { ...i, quantity: i.quantity + quantity } : i)
            return [...prev, { ...product, quantity }]
        })
    }
    const removeFromCart = (pid) => setCart(prev => prev.filter(i => String(i.id) !== String(pid)))
    const updateQuantity = (pid, delta) => setCart(prev => prev.map(i => String(i.id) === String(pid) ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i))
    const setQuantity = (pid, val, newPrice = null) => setCart(prev => prev.map(i => String(i.id) === String(pid) ? { ...i, quantity: Math.max(0, val), price: newPrice !== null ? newPrice : i.price } : i))

    const subtotal = cart.reduce((a, i) => a + (i.price * i.quantity), 0)
    const finalTotal = Math.max(0, subtotal + (sale?.tax || 0) - (sale?.discount || 0))

    const handleSave = () => {
        if (cart.length === 0) return alert('Debe tener al menos un producto')
        onSave({
            customer_id: sale.customer_id, branch_id: sale.branch_id,
            subtotal, tax: sale.tax || 0, discount: sale.discount || 0,
            total: finalTotal, is_credit: sale.is_credit,
            items: cart.map(i => ({ product_id: i.id, name: i.name, sku: i.sku, quantity: i.quantity, price: i.price, total: i.price * i.quantity }))
        })
    }

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '1200px', maxHeight: '95vh', padding: 0, borderRadius: '28px', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: 'hsl(var(--background))' }}>

                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.08)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.6rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '14px' }}><ClipboardList size={24} /></div>
                        <div>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em' }}>Modificar Venta #{sale?.sale_number || sale?.id?.slice(0, 8)}</h2>
                            <p style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Sucursal: {sale?.branches?.name} • Cliente: {sale?.customers?.name || 'Cliente General'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }} disabled={isSaving}><X size={22} /></button>
                </div>

                {/* Scrollable Body — CART FIRST, then Catalog */}
                <div className="no-scrollbar" style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* ====== CART (existing products) — ALWAYS VISIBLE FIRST ====== */}
                    <div className="card shadow-lg" style={{ display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '22px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'hsl(var(--background))' }}>
                        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{ padding: '0.4rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '10px' }}><ShoppingCart size={18} /></div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0 }}>Productos de la Venta</h3>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: '800', backgroundColor: 'hsl(var(--primary))', color: 'white', padding: '3px 10px', borderRadius: '99px' }}>{cart.length} PRODUCTOS</span>
                        </div>

                        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {loading ? (
                                <div style={{ padding: '2rem', textAlign: 'center' }}><RefreshCw size={30} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.3 }} /></div>
                            ) : cart.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.3 }}>
                                    <ShoppingCart size={40} style={{ margin: '0 auto 0.75rem' }} />
                                    <p style={{ fontWeight: '800' }}>Sin productos</p>
                                    <p style={{ fontSize: '0.8rem' }}>Agregue productos desde el catálogo.</p>
                                </div>
                            ) : cart.map(item => (
                                <div key={item.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.65rem', backgroundColor: 'hsl(var(--background))', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.5)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    <div style={{ width: '40px', height: '40px', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                        {item.image_url ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Box size={18} opacity={0.4} />}
                                    </div>
                                    <div style={{ flex: 1.5, minWidth: 0 }}>
                                        <h4 style={{ fontSize: '0.85rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.15rem' }}>{item.name}</h4>
                                        <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.4, fontWeight: '700' }}>SKU: {item.sku || 'N/A'}</p>
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>Precio Unit.</p>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3, fontSize: '0.75rem' }}>{currencySymbol}</span>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                style={{ width: '100%', padding: '0.35rem 0.5rem 0.35rem 1.4rem', fontSize: '0.85rem', fontWeight: '900', color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--secondary) / 0.2)', border: '1px solid hsl(var(--border) / 0.3)', borderRadius: '10px', outline: 'none' }} 
                                                value={item.price} 
                                                onChange={(e) => setQuantity(item.id, item.quantity, parseFloat(e.target.value) || 0)} 
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'hsl(var(--secondary) / 0.2)', borderRadius: '12px', padding: '0.35rem', border: '1px solid hsl(var(--border) / 0.4)' }}>
                                        <button className="btn" style={{ width: '30px', height: '30px', padding: 0, borderRadius: '9px', backgroundColor: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button>
                                        <input type="number" style={{ width: '40px', fontSize: '0.9rem', fontWeight: '900', textAlign: 'center', backgroundColor: 'transparent', border: 'none', outline: 'none' }} value={item.quantity} onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)} />
                                        <button className="btn" style={{ width: '30px', height: '30px', padding: 0, borderRadius: '9px', backgroundColor: 'hsl(var(--primary))', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => updateQuantity(item.id, 1)}><Plus size={14} /></button>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                        <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>Subtotal</p>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900', color: 'hsl(var(--primary))' }}>{currencySymbol}{(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                    <button className="btn" style={{ color: 'hsl(var(--destructive) / 0.5)', padding: '0.4rem', borderRadius: '9px' }} onClick={() => removeFromCart(item.id)}><Trash2 size={16} /></button>
                                </div>
                            ))}
                        </div>

                        {/* Totals + Save */}
                        <div style={{ padding: '1.25rem 1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderTop: '2px dashed hsl(var(--border) / 0.4)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', opacity: 0.5, textTransform: 'uppercase' }}>Subtotal</p>
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>{currencySymbol}{subtotal.toFixed(2)}</p>
                                    </div>
                                    <div style={{ backgroundColor: 'white', padding: '0.6rem 1.25rem', borderRadius: '18px', border: '1px solid hsl(var(--border) / 0.4)' }}>
                                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '900', opacity: 0.4, textTransform: 'uppercase' }}>Nuevo Total</p>
                                        <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: '900', color: 'hsl(var(--primary))', letterSpacing: '-0.03em' }}>{currencySymbol}{finalTotal.toFixed(2)}</p>
                                    </div>
                                </div>
                                <button className="btn btn-primary" disabled={isSaving || cart.length === 0} onClick={handleSave} style={{ padding: '1rem 2.5rem', borderRadius: '18px', fontSize: '1.1rem', fontWeight: '900', boxShadow: '0 10px 25px -5px rgb(var(--primary) / 0.4)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {isSaving ? <><Loader2 size={22} className="animate-spin" /> GUARDANDO...</> : <><Save size={22} /> GUARDAR CAMBIOS</>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ====== CATALOG SECTION — Toggle to show/hide ====== */}
                    <button
                        onClick={() => setShowCatalog(!showCatalog)}
                        className="btn"
                        style={{
                            width: '100%', padding: '1rem', borderRadius: '16px',
                            border: '2px dashed hsl(var(--primary) / 0.3)',
                            backgroundColor: 'hsl(var(--primary) / 0.03)',
                            color: 'hsl(var(--primary))', fontWeight: '800', fontSize: '0.95rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Plus size={20} />
                        {showCatalog ? 'OCULTAR CATÁLOGO' : 'AGREGAR PRODUCTOS DEL CATÁLOGO'}
                        <ChevronRight size={18} style={{ transform: showCatalog ? 'rotate(90deg)' : 'none', transition: '0.2s' }} />
                    </button>

                    {showCatalog && (
                        <>
                            {/* Brand & Search */}
                            <div className="card shadow-sm" style={{ padding: '1.25rem 1.5rem', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.5)', display: 'grid', gridTemplateColumns: '1.5fr 2fr', gap: '1.25rem', position: 'relative', zIndex: 50 }}>
                                <div style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', display: 'block' }}>Marca</label>
                                    <button onClick={() => setIsBrandListOpen(!isBrandListOpen)} style={{ width: '100%', padding: '0.7rem 0.85rem', borderRadius: '12px', border: '1.5px solid hsl(var(--primary) / 0.1)', backgroundColor: 'hsl(var(--secondary) / 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Tag size={16} style={{ opacity: 0.3 }} /><span>{selectedBrandId === 'all' ? 'Todas las marcas' : brands.find(b => b.id === selectedBrandId)?.name || 'Seleccione...'}</span></div>
                                        <ChevronRight size={16} style={{ transform: isBrandListOpen ? 'rotate(90deg)' : 'none', transition: '0.2s', opacity: 0.3 }} />
                                    </button>
                                    {isBrandListOpen && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem', backgroundColor: 'white', borderRadius: '14px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid hsl(var(--border) / 0.6)', maxHeight: '250px', overflowY: 'auto', zIndex: 150, padding: '0.4rem' }}>
                                            <div onClick={() => { setSelectedBrandId('all'); setIsBrandListOpen(false) }} style={{ padding: '0.7rem 0.85rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem', color: selectedBrandId === 'all' ? 'hsl(var(--primary))' : 'inherit', backgroundColor: selectedBrandId === 'all' ? 'hsl(var(--primary) / 0.05)' : 'transparent' }}>TODAS LAS MARCAS</div>
                                            {brands.filter(b => b.id !== 'all').map(b => (
                                                <div key={b.id} onClick={() => { setSelectedBrandId(b.id); setIsBrandListOpen(false) }} style={{ padding: '0.7rem 0.85rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem', color: selectedBrandId === b.id ? 'hsl(var(--primary))' : 'inherit', backgroundColor: selectedBrandId === b.id ? 'hsl(var(--primary) / 0.05)' : 'transparent', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: 'hsl(var(--secondary) / 0.5)', overflow: 'hidden' }}>{b.logo_url && <img src={b.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}</div>
                                                    {b.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.5rem', display: 'block' }}>Buscar productos</label>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                        <input type="text" placeholder="Nombre, SKU o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '0.7rem 0.85rem 0.7rem 2.75rem', borderRadius: '12px', border: '1.5px solid hsl(var(--primary) / 0.1)', backgroundColor: 'hsl(var(--secondary) / 0.2)', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }} />
                                    </div>
                                </div>
                            </div>

                            {/* View toggle */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '2px', backgroundColor: 'hsl(var(--secondary) / 0.4)', padding: '3px', borderRadius: '10px' }}>
                                    <button onClick={() => setViewMode('list')} style={{ padding: '5px', borderRadius: '7px', border: 'none', backgroundColor: viewMode === 'list' ? 'hsl(var(--background))' : 'transparent', color: viewMode === 'list' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ClipboardList size={18} /></button>
                                    <button onClick={() => setViewMode('grid')} style={{ padding: '5px', borderRadius: '7px', border: 'none', backgroundColor: viewMode === 'grid' ? 'hsl(var(--background))' : 'transparent', color: viewMode === 'grid' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LayoutGrid size={18} /></button>
                                </div>
                                <button onClick={() => setGridRefreshKey(p => p + 1)} className="btn" style={{ padding: '0.4rem', borderRadius: '12px', backgroundColor: 'hsl(var(--secondary) / 0.4)' }}><RefreshCw size={18} opacity={0.5} /></button>
                            </div>

                            {/* Product Grid */}
                            <div className="no-scrollbar" onClick={() => setIsBrandListOpen(false)}>
                                <ProductGrid searchTerm={searchTerm} branchId={branchId} brandId={selectedBrandId} onAddToCart={addToCart} currencySymbol={currencySymbol} refreshKey={gridRefreshKey} viewMode={viewMode} stockFilter="in-stock" excludeIds={cart.map(i => i.id)} />
                            </div>
                        </>
                    )}
                </div>

                <style>{`input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}`}</style>
            </div>
        </div>
    )
}
