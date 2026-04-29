import React, { useState, useEffect, useMemo } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, Building2, Package, ShoppingCart, Trash, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function PurchaseModal({ onClose, onSave, isSaving, initialData, currencySymbol = 'Bs.', readOnly = false }) {
    const [branches, setBranches] = useState([])
    const [products, setProducts] = useState([])
    const [brands, setBrands] = useState([])
    const [selectedBrand, setSelectedBrand] = useState(null)
    const [brandSearch, setBrandSearch] = useState('')
    const [isBrandListOpen, setIsBrandListOpen] = useState(false)
    const [items, setItems] = useState(initialData?.items || [])
    const [searchTerm, setSearchTerm] = useState('')
    const [error, setError] = useState(null)
    const [quantities, setQuantities] = useState({}) // product_id -> quantity

    useEffect(() => {
        async function fetchInitialData() {
            try {
                const [branchesRes, productsRes, brandsRes] = await Promise.all([
                    supabase.from('branches').select('*').eq('active', true).order('name'),
                    supabase.from('products').select(`
                        *,
                        brand:brands(name),
                        product_branch_settings(stock, branch_id)
                    `).eq('active', true).order('name'),
                    supabase.from('brands').select('*').order('name')
                ])

                const allBranches = branchesRes.data || []
                setBranches(allBranches)
                setProducts(productsRes.data || [])
                setBrands(brandsRes.data || [])

                // We don't auto-select a brand anymore to force the user to pick one
            } catch (err) {
                console.error(err)
            }
        }
        fetchInitialData()
    }, [initialData])

    const handleQuantityChange = (productId, value) => {
        const val = parseInt(value)
        setQuantities(prev => ({
            ...prev,
            [productId]: isNaN(val) ? '' : Math.max(0, val)
        }))
    }

    const addItem = (product) => {
        const qty = parseInt(quantities[product.id]) || 1
        if (qty <= 0) return

        setItems(prev => {
            const existing = prev.find(i => i.product_id === product.id)
            if (existing) {
                const newQty = existing.quantity + qty
                return prev.map(i => i.product_id === product.id ? { ...i, quantity: newQty, total: 0 } : i)
            }
            return [...prev, {
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                brand_name: product.brand?.name,
                quantity: qty,
                unit_cost: 0,
                total: 0,
                is_pack: false,
                units_per_pack: 1
            }]
        })
        setQuantities(prev => ({ ...prev, [product.id]: 1 }))
    }

    const removeItem = (productId) => {
        setItems(prev => prev.filter(i => i.product_id !== productId))
    }

    const updateItemQuantity = (productId, newQty) => {
        if (newQty === '') {
            setItems(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: '' } : i))
            return
        }
        const qty = parseInt(newQty)
        if (isNaN(qty)) return
        setItems(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i))
    }

    const totalItems = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items])

    const handleSubmit = (e) => {
        e.preventDefault()
        const mat = branches.find(b => b.name.toLowerCase().includes('casa matriz'))
        if (!mat) return setError('No se encontró la sucursal Casa Matriz.')
        if (items.length === 0) return setError('Debe agregar al menos un producto.')

        onSave({
            supplier_id: null,
            branch_id: mat.id,
            total: 0,
            items: items
        })
    }

    const filteredBrands = useMemo(() => {
        return brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
    }, [brands, brandSearch])

    const filteredProducts = useMemo(() => {
        if (!selectedBrand && !searchTerm) return []
        return products.filter(p => {
            const matchesBrand = selectedBrand ? p.brand_id === selectedBrand.id : true
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
            const isAlreadyAdded = items.some(item => item.product_id === p.id)
            return matchesBrand && matchesSearch && !isAlreadyAdded
        })
    }, [products, selectedBrand, searchTerm, items])

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}>
            <div className="card shadow-2xl" style={{
                width: '100%',
                maxWidth: '1200px',
                padding: 0,
                backgroundColor: 'hsl(var(--background))',
                borderRadius: '32px',
                border: '1px solid hsl(var(--border) / 0.8)',
                animation: 'modalFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                margin: '0 auto 5rem auto'
            }}>
                {/* Header */}
                <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50 }}>
                    <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.02em', margin: 0 }}>
                            {readOnly ? 'Detalle de Carga' : 'Cargar Inventario'}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', opacity: 0.6 }}>
                            <Building2 size={14} />
                            <span style={{ fontWeight: '800', fontSize: '0.8rem' }}>Matriz</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.4, padding: '0.5rem' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Selectors Area (Hidden in readOnly) */}
                {!readOnly && (
                    <div style={{ padding: '1.5rem 2rem', backgroundColor: 'hsl(var(--secondary) / 0.05)', borderBottom: '1px solid hsl(var(--border) / 0.3)', display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', zIndex: 40 }}>
                        {/* Searchable Brand Selector */}
                        <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.4rem', display: 'block' }}>Marca (Buscador)</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="text"
                                    placeholder={selectedBrand ? selectedBrand.name : "Seleccione marca..."}
                                    style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'white', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
                                    value={brandSearch}
                                    onChange={(e) => {
                                        setBrandSearch(e.target.value);
                                        setIsBrandListOpen(true);
                                    }}
                                    onFocus={() => setIsBrandListOpen(true)}
                                />
                                <ChevronDown size={16} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                            </div>
                            
                            {isBrandListOpen && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem', backgroundColor: 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.6)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '250px', overflowY: 'auto', zIndex: 100 }}>
                                    {filteredBrands.length === 0 ? (
                                        <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>No se encontraron marcas</div>
                                    ) : (
                                        filteredBrands.map(b => (
                                            <div 
                                                key={b.id} 
                                                onClick={() => {
                                                    setSelectedBrand(b);
                                                    setBrandSearch('');
                                                    setIsBrandListOpen(false);
                                                }}
                                                style={{ padding: '0.75rem 1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '700', borderBottom: '1px solid hsl(var(--border) / 0.2)', backgroundColor: selectedBrand?.id === b.id ? 'hsl(var(--primary) / 0.05)' : 'transparent' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.3)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedBrand?.id === b.id ? 'hsl(var(--primary) / 0.05)' : 'transparent'}
                                            >
                                                {b.name}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Product Search */}
                        <div>
                            <label style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.4rem', display: 'block' }}>Buscar en productos</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input
                                    type="text"
                                    placeholder="Nombre o SKU..."
                                    style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'white', fontSize: '0.9rem', fontWeight: '700', outline: 'none' }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}
                {/* Main Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }} onClick={() => setIsBrandListOpen(false)}>
                    
                    {/* Products List Section - Back at the Top */}
                    {!readOnly && (
                        <div style={{ padding: '1.5rem 2rem', backgroundColor: 'hsl(var(--secondary) / 0.02)' }}>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '1rem', letterSpacing: '0.05em' }}>
                                {selectedBrand ? `Agregar más productos de ${selectedBrand.name}` : 'Seleccione una marca para agregar más productos'}
                            </h3>

                            {!selectedBrand ? (
                                <div style={{ padding: '3rem 2rem', textAlign: 'center', opacity: 0.3 }}>
                                    <Package size={48} strokeWidth={1} style={{ margin: '0 auto 1rem' }} />
                                    <p style={{ fontWeight: '800', fontSize: '1rem' }}>Busca una marca arriba para añadir productos a esta carga</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {filteredProducts.map(p => {
                                        const matBranch = branches.find(b => b.name.toLowerCase().includes('casa matriz'))
                                        const matStock = p.product_branch_settings?.find(s => s.branch_id === matBranch?.id)?.stock || 0
                                        return (
                                            <div key={p.id} style={{ padding: '0.6rem 1rem', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.3)', backgroundColor: 'white', display: 'grid', gridTemplateColumns: '40px 2.5fr 1fr 1.2fr', alignItems: 'center', gap: '1.5rem' }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'hsl(var(--secondary) / 0.3)', overflow: 'hidden' }}>
                                                    {p.image_url ? <img src={p.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={18} style={{ margin: '11px', opacity: 0.1 }} />}
                                                </div>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>{p.name}</p>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', opacity: 0.4 }}>SKU: {p.sku || '---'}</span>
                                                </div>
                                                <div style={{ textAlign: 'center' }}>
                                                    <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>Stock</p>
                                                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: matStock <= 5 ? 'hsl(var(--destructive))' : 'inherit' }}>{matStock}</p>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.2)', borderRadius: '10px', padding: '0.2rem' }}>
                                                        <button onClick={() => handleQuantityChange(p.id, (parseInt(quantities[p.id]) || 1) - 1)} style={{ width: '28px', height: '28px', border: 'none', background: 'none', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                                                        <input 
                                                            type="number"
                                                            value={quantities[p.id] ?? 1}
                                                            onChange={(e) => handleQuantityChange(p.id, e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    addItem(p);
                                                                }
                                                            }}
                                                            style={{ width: '70px', textAlign: 'center', fontWeight: '800', fontSize: '1rem', border: 'none', background: 'none', outline: 'none' }}
                                                        />
                                                        <button onClick={() => handleQuantityChange(p.id, (parseInt(quantities[p.id]) || 1) + 1)} style={{ width: '28px', height: '28px', border: 'none', background: 'none', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                                                    </div>
                                                    <button onClick={() => addItem(p)} style={{ flex: 1, padding: '0.6rem', borderRadius: '10px', border: 'none', backgroundColor: 'hsl(var(--primary))', color: 'white', fontWeight: '900', fontSize: '0.85rem', cursor: 'pointer' }}>AGREGAR</button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cart List Section - Back at the Bottom */}
                    <div style={{ padding: '0 2rem 2rem', marginTop: '1rem', borderTop: readOnly ? 'none' : '2px dashed hsl(var(--border) / 0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0 1rem' }}>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', color: 'hsl(var(--primary))', letterSpacing: '0.05em', margin: 0 }}>
                                {readOnly ? 'Resumen de Productos Cargados' : `Productos en esta carga (${items.length})`}
                            </h3>
                            <ShoppingCart size={18} style={{ opacity: 0.3 }} />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {items.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed hsl(var(--border) / 0.5)', borderRadius: '16px', opacity: 0.4 }}>
                                    <p style={{ fontWeight: '700', fontSize: '0.9rem' }}>No hay productos agregados todavía</p>
                                </div>
                            ) : (
                                items.map(item => (
                                    <div key={item.product_id} style={{ padding: '0.75rem 1.25rem', borderRadius: '14px', border: '1px solid hsl(var(--primary) / 0.2)', backgroundColor: 'hsl(var(--primary) / 0.03)', display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr auto', alignItems: 'center', gap: '1rem' }}>
                                        <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>{item.name}</p>
                                        <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.5 }}>CANT:</span>
                                            {readOnly ? (
                                                <span style={{ marginLeft: '6px', fontWeight: '900', fontSize: '1rem' }}>{item.quantity}</span>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.4)', padding: '2px' }}>
                                                    <button onClick={() => updateItemQuantity(item.product_id, item.quantity - 1)} style={{ width: '24px', height: '24px', border: 'none', background: 'none', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                                                    <input 
                                                        type="number"
                                                        value={item.quantity ?? ''}
                                                        onChange={(e) => updateItemQuantity(item.product_id, e.target.value)}
                                                        style={{ width: '70px', textAlign: 'center', fontWeight: '800', fontSize: '0.9rem', border: 'none', background: 'none', outline: 'none' }}
                                                    />
                                                    <button onClick={() => updateItemQuantity(item.product_id, item.quantity + 1)} style={{ width: '24px', height: '24px', border: 'none', background: 'none', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}></div>
                                        {!readOnly && (
                                            <button onClick={() => removeItem(item.product_id)} style={{ border: 'none', background: 'none', color: 'hsl(var(--destructive))', cursor: 'pointer', padding: '4px' }}>
                                                <Trash2 size={20} />
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>


                {/* Sticky Footer */}
                <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid hsl(var(--border) / 0.4)', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '800', opacity: 0.5, textTransform: 'uppercase' }}>TOTAL PRODUCTOS</p>
                        <p style={{ margin: 0, fontSize: '2rem', fontWeight: '1000', color: 'hsl(var(--primary))', letterSpacing: '-0.02em' }}>{totalItems} uds.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {readOnly ? (
                            <button 
                                onClick={onClose} 
                                style={{ padding: '0.75rem 2.5rem', borderRadius: '14px', border: 'none', backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', fontWeight: '1000', fontSize: '1.1rem', cursor: 'pointer' }}
                            >
                                CERRAR DETALLE
                            </button>
                        ) : (
                            <>
                                <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', border: '2px solid hsl(var(--border))', backgroundColor: 'white', fontWeight: '900', cursor: 'pointer' }}>CANCELAR</button>
                                <button 
                                    onClick={handleSubmit} 
                                    disabled={isSaving || items.length === 0}
                                    style={{ padding: '0.75rem 2.5rem', borderRadius: '14px', border: 'none', backgroundColor: 'hsl(var(--primary))', color: 'white', fontWeight: '1000', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 8px 20px -6px hsl(var(--primary) / 0.4)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}
                                >
                                    {isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                                    FINALIZAR CARGA
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: translateY(40px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                ::-webkit-scrollbar {
                    width: 6px;
                }
                ::-webkit-scrollbar-track {
                    background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                    background-color: hsl(var(--border));
                    border-radius: 20px;
                }
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                  -webkit-appearance: none; 
                  margin: 0; 
                }
            `}</style>
        </div>
    )
}
