import React, { useState, useEffect, useMemo } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, ArrowRight, Building2, Package, MapPin, ChevronRight, Info, ArrowLeftRight, Box, Layers, ShoppingCart } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function TransferModal({ onClose, onSave, isSaving, initialData = null, readOnly = false }) {
    const [branches, setBranches] = useState([])
    const [products, setProducts] = useState([])
    const [brands, setBrands] = useState([])
    const [models, setModels] = useState([])
    const [selectedModelId, setSelectedModelId] = useState('')
    const [selectedBrand, setSelectedBrand] = useState(null)
    const [branchStock, setBranchStock] = useState({})
    const [originBranch, setOriginBranch] = useState(initialData?.origin_branch_id || '')
    const [destBranch, setDestBranch] = useState(initialData?.destination_branch_id || '')
    const [items, setItems] = useState(initialData?.items || [])
    const [searchTerm, setSearchTerm] = useState('')
    const [error, setError] = useState(null)
    
    // UI State
    const [isBrandListOpen, setIsBrandListOpen] = useState(false)
    const [quantities, setQuantities] = useState({}) // product_id -> quantity

    async function fetchInitialData() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            const isUserAdmin = profile?.role === 'Administrador'

            const { data: assignments } = await supabase
                .from('user_branches')
                .select('branch_id')
                .eq('user_id', user.id)

            const assignedIds = assignments?.map(a => a.branch_id) || []

            const [branchesRes, productsRes, brandsRes, modelsRes] = await Promise.all([
                supabase.from('branches').select('*').eq('active', true).order('name'),
                supabase.from('products').select(`
                    *,
                    brand:brands(name)
                `).eq('active', true).order('name'),
                supabase.from('brands').select('*').order('name'),
                supabase.from('models').select('*').order('name')
            ])

            let availableBranches = branchesRes.data || []
            if (!isUserAdmin && assignedIds.length > 0) {
                availableBranches = availableBranches.filter(b => assignedIds.includes(b.id))
            }

            setBranches(availableBranches)
            const allProducts = productsRes.data || []
            setProducts(allProducts)
            setBrands(brandsRes.data || [])
            setModels(modelsRes.data || [])

            // Enrich initial items with product details
            if (initialData?.items) {
                const enrichedItems = initialData.items.map(item => {
                    const p = allProducts.find(prod => prod.id === item.product_id)
                    return {
                        ...item,
                        name: p?.name || 'Producto Desconocido',
                        sku: p?.sku || '---',
                        quantity: item.quantity || item.display_quantity || 1
                    }
                })
                setItems(enrichedItems)
            }

            if (!initialData && availableBranches.length > 0) {
                setOriginBranch(availableBranches[0].id)
                if (availableBranches.length > 1) {
                    setDestBranch(availableBranches[1].id)
                }
            }
        } catch (err) {
            console.error('Error:', err)
        }
    }

    async function fetchBranchStock() {
        if (!originBranch) return
        try {
            const { data } = await supabase
                .from('product_branch_settings')
                .select('product_id, stock')
                .eq('branch_id', originBranch)

            if (data) {
                const stockMap = {}
                data.forEach(item => { stockMap[item.product_id] = item.stock })
                setBranchStock(stockMap)
            }
        } catch (err) {
            console.error('Error fetching stock:', err)
        }
    }

    useEffect(() => {
        fetchInitialData()
    }, [])

    useEffect(() => {
        fetchBranchStock()
    }, [originBranch])

    const availableBrands = useMemo(() => {
        if (products.length === 0) return brands
        const brandIdsWithStock = new Set()
        products.forEach(p => {
            if ((branchStock[p.id] || 0) > 0) {
                brandIdsWithStock.add(p.brand_id)
            }
        })
        return brands.filter(b => brandIdsWithStock.has(b.id))
    }, [brands, products, branchStock])

    const filteredProducts = useMemo(() => {
        if (!selectedBrand && !searchTerm) return []
        return products.filter(p => {
            const matchesBrand = selectedBrand ? p.brand_id === selectedBrand.id : true
            const matchesModel = selectedModelId ? p.model_id === selectedModelId : true
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
            const isAlreadyAdded = items.some(item => item.product_id === p.id)
            return matchesBrand && matchesModel && matchesSearch && !isAlreadyAdded
        })
    }, [products, selectedBrand, selectedModelId, searchTerm, items])

    const addItem = (product) => {
        const qty = parseInt(quantities[product.id]) || 1
        const availableStock = branchStock[product.id] || 0
        
        if (availableStock <= 0) {
            setError(`No hay stock disponible para "${product.name}"`)
            return
        }
        
        if (qty > availableStock) {
            setError(`Solo hay ${availableStock} unidades disponibles de "${product.name}"`)
            return
        }

        setError(null)
        setItems(prev => {
            const existing = prev.find(i => i.product_id === product.id)
            if (existing) {
                const newQty = existing.quantity + qty
                if (newQty > availableStock) {
                    setError(`La cantidad total excede el stock disponible (${availableStock})`)
                    return prev
                }
                return prev.map(i => i.product_id === product.id ? { ...i, quantity: newQty } : i)
            }
            return [...prev, {
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                quantity: qty
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

        const stock = branchStock[productId] || 0
        if (qty > stock) {
            setError(`No puedes traspasar más de ${stock} unidades de este producto.`)
            return
        }

        setError(null)
        setItems(prev => prev.map(i => i.product_id === productId ? { ...i, quantity: qty } : i))
    }

    const handleQuantityChange = (productId, val) => {
        if (val === '') {
            setQuantities(prev => ({ ...prev, [productId]: '' }))
            return
        }
        const qty = parseInt(val)
        if (isNaN(qty)) return
        setQuantities(prev => ({ ...prev, [productId]: qty }))
    }

    const totalItems = useMemo(() => items.reduce((acc, item) => {
        const qty = parseInt(item.quantity) || 0
        return acc + qty
    }, 0), [items])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!originBranch || !destBranch) return setError('Seleccione ambas sucursales.')
        if (originBranch === destBranch) return setError('Origen y destino no pueden ser iguales.')
        if (items.length === 0) return setError('Agregue al menos un producto.')

        // Check stock
        for (const item of items) {
            const stock = branchStock[item.product_id] || 0
            if (item.quantity > stock) {
                return setError(`Stock insuficiente para "${item.name}" (Disp: ${stock}, Req: ${item.quantity})`)
            }
        }

        onSave({
            origin_branch_id: originBranch,
            destination_branch_id: destBranch,
            items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity }))
        })
    }

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem' }}>
            <div style={{ width: '100%', maxWidth: '1000px', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', margin: '0 auto 5rem auto' }}>
                
                {/* Header */}
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.4)', backgroundColor: 'hsl(var(--secondary) / 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.6rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}>
                            <ArrowLeftRight size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, letterSpacing: '-0.02em' }}>
                                {readOnly ? 'Detalles del Traspaso' : (initialData ? 'Modificar Traspaso' : 'Nuevo Traspaso')}
                            </h2>
                            <p style={{ fontSize: '0.75rem', fontWeight: '700', opacity: 0.4, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Movimiento logístico entre sucursales
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'hsl(var(--foreground))', opacity: 0.3 }}><X size={24} /></button>
                </div>

                {/* Branch Selectors Bar */}
                {!readOnly && (
                    <div style={{ padding: '1rem 2rem', backgroundColor: 'hsl(var(--primary) / 0.02)', borderBottom: '1px solid hsl(var(--border) / 0.3)', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.4rem', display: 'block' }}>Sucursal Origen</label>
                            {branches.length > 1 ? (
                                <select 
                                    value={originBranch}
                                    onChange={(e) => setOriginBranch(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.4)', fontWeight: '800', fontSize: '0.9rem' }}
                                >
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            ) : (
                                <div style={{ padding: '0.6rem', fontWeight: '800', fontSize: '0.9rem', backgroundColor: 'white', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.2)' }}>
                                    {branches[0]?.name}
                                </div>
                            )}
                        </div>
                        <div style={{ color: 'hsl(var(--primary) / 0.3)', marginTop: '1rem' }}><ArrowRight size={20} /></div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.4rem', display: 'block' }}>Sucursal Destino</label>
                            {branches.length > 1 ? (
                                <select 
                                    value={destBranch}
                                    onChange={(e) => setDestBranch(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.4)', fontWeight: '800', fontSize: '0.9rem' }}
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id} disabled={b.id === originBranch}>
                                            {b.name} {b.id === originBranch ? '(Origen)' : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div style={{ padding: '0.6rem', fontWeight: '800', fontSize: '0.9rem', backgroundColor: 'white', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.2)' }}>
                                    {branches[0]?.name}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Catalog Selectors Section */}
                {!readOnly && (
                    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.3)', display: 'grid', gridTemplateColumns: '1.5fr 2fr', gap: '1.5rem', position: 'relative', zIndex: 10 }}>
                        <div style={{ position: 'relative' }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.6rem', display: 'block' }}>Marca (Buscador)</label>
                            <button 
                                onClick={() => setIsBrandListOpen(!isBrandListOpen)}
                                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1.5px solid hsl(var(--primary) / 0.1)', backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: '700', fontSize: '0.95rem' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Search size={18} style={{ opacity: 0.3 }} />
                                    <span>{selectedBrand ? selectedBrand.name : 'Seleccione marca...'}</span>
                                </div>
                                <ChevronRight size={18} style={{ transform: isBrandListOpen ? 'rotate(90deg)' : 'none', transition: '0.2s', opacity: 0.3 }} />
                            </button>

                            {isBrandListOpen && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.5rem', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: '1px solid hsl(var(--border) / 0.6)', maxHeight: '300px', overflowY: 'auto', zIndex: 50, padding: '0.5rem' }}>
                                    <div 
                                        onClick={() => { setSelectedBrand(null); setIsBrandListOpen(false); }}
                                        style={{ padding: '0.8rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', color: !selectedBrand ? 'hsl(var(--primary))' : 'inherit', backgroundColor: !selectedBrand ? 'hsl(var(--primary) / 0.05)' : 'transparent' }}
                                    >
                                        TODAS LAS MARCAS
                                    </div>
                                    {availableBrands.map(b => (
                                        <div 
                                            key={b.id}
                                            onClick={() => { setSelectedBrand(b); setIsBrandListOpen(false); }}
                                            style={{ padding: '0.8rem 1rem', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '0.9rem', color: selectedBrand?.id === b.id ? 'hsl(var(--primary))' : 'inherit', backgroundColor: selectedBrand?.id === b.id ? 'hsl(var(--primary) / 0.05)' : 'transparent', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
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

                        <div>
                            <label style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '0.6rem', display: 'block' }}>Buscar en productos</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                                <input 
                                    type="text" 
                                    placeholder="Nombre o SKU..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3rem', borderRadius: '12px', border: '1.5px solid hsl(var(--primary) / 0.1)', fontSize: '0.95rem', fontWeight: '700', outline: 'none' }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Level 2: Models Bar (Lineas de Producto) */}
                {!readOnly && selectedBrand && (
                    <div style={{ 
                        padding: '0.5rem 2rem 1rem', 
                        display: 'flex', 
                        gap: '0.75rem', 
                        overflowX: 'auto', 
                        msOverflowStyle: 'none', 
                        scrollbarWidth: 'none',
                        borderBottom: '1px solid hsl(var(--border) / 0.3)',
                        backgroundColor: 'white'
                    }}>
                        <button 
                            onClick={() => setSelectedModelId('')}
                            style={{
                                padding: '0.4rem 1.25rem',
                                borderRadius: '100px',
                                backgroundColor: !selectedModelId ? 'hsl(var(--primary) / 0.8)' : 'hsl(var(--secondary) / 0.4)',
                                color: !selectedModelId ? 'white' : 'inherit',
                                border: 'none',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Todos los productos
                        </button>
                        {models.filter(m => m.brand_id === selectedBrand.id).map(m => (
                            <button 
                                key={m.id}
                                onClick={() => setSelectedModelId(m.id)}
                                style={{
                                    padding: '0.4rem 1.25rem',
                                    borderRadius: '100px',
                                    backgroundColor: selectedModelId === m.id ? 'hsl(var(--primary) / 0.8)' : 'hsl(var(--secondary) / 0.2)',
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

                {/* Main Content Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }} onClick={() => setIsBrandListOpen(false)}>
                    
                    {/* Catalog Results (Top) */}
                    {!readOnly && (
                        <div style={{ padding: '1.5rem 2rem', backgroundColor: 'hsl(var(--secondary) / 0.02)' }}>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.4, marginBottom: '1rem', letterSpacing: '0.05em' }}>
                                {selectedBrand ? `Agregar productos de ${selectedBrand.name}` : 'Productos disponibles para traspaso'}
                            </h3>

                            {(searchTerm || selectedBrand) ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {filteredProducts.map(p => {
                                        const stock = branchStock[p.id] || 0
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
                                                    <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>Stock Origen</p>
                                                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: stock <= 0 ? 'hsl(var(--destructive))' : 'inherit' }}>{stock}</p>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.2)', borderRadius: '10px', padding: '0.2rem' }}>
                                                        <button onClick={() => handleQuantityChange(p.id, (parseInt(quantities[p.id]) || 1) - 1)} style={{ width: '28px', height: '28px', border: 'none', background: 'none', fontWeight: 'bold', cursor: 'pointer' }}>-</button>
                                                        <input 
                                                            type="number"
                                                            value={quantities[p.id] ?? 1}
                                                            onChange={(e) => handleQuantityChange(p.id, e.target.value)}
                                                            style={{ width: '70px', textAlign: 'center', fontWeight: '800', fontSize: '1rem', border: 'none', background: 'none', outline: 'none' }}
                                                        />
                                                        <button onClick={() => handleQuantityChange(p.id, (parseInt(quantities[p.id]) || 1) + 1)} style={{ width: '28px', height: '28px', border: 'none', background: 'none', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                                                    </div>
                                                    <button 
                                                        disabled={stock <= 0}
                                                        onClick={() => addItem(p)} 
                                                        style={{ flex: 1, padding: '0.6rem', borderRadius: '10px', border: 'none', backgroundColor: 'hsl(var(--primary))', color: 'white', fontWeight: '900', fontSize: '0.85rem', cursor: stock <= 0 ? 'not-allowed' : 'pointer', opacity: stock <= 0 ? 0.5 : 1 }}
                                                    >
                                                        AGREGAR
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div style={{ padding: '3rem 2rem', textAlign: 'center', opacity: 0.3 }}>
                                    <Package size={48} strokeWidth={1} style={{ margin: '0 auto 1rem' }} />
                                    <p style={{ fontWeight: '800', fontSize: '1rem' }}>Busca una marca o producto arriba para añadir al traspaso</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cart List (Bottom) */}
                    <div style={{ padding: '0 2rem 2rem', marginTop: '1rem', borderTop: readOnly ? 'none' : '2px dashed hsl(var(--border) / 0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0 1rem' }}>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase', color: 'hsl(var(--primary))', letterSpacing: '0.05em', margin: 0 }}>
                                {readOnly ? 'Productos en este Traspaso' : `Productos seleccionados (${items.length})`}
                            </h3>
                            <ShoppingCart size={18} style={{ opacity: 0.3 }} />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {items.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed hsl(var(--border) / 0.5)', borderRadius: '16px', opacity: 0.4 }}>
                                    <p style={{ fontWeight: '700', fontSize: '0.9rem' }}>No hay productos seleccionados todavía</p>
                                </div>
                            ) : (
                                items.map(item => (
                                    <div key={item.product_id} style={{ padding: '0.75rem 1.25rem', borderRadius: '14px', border: '1px solid hsl(var(--primary) / 0.2)', backgroundColor: 'hsl(var(--primary) / 0.03)', display: 'grid', gridTemplateColumns: '2.5fr 1.5fr 1fr auto', alignItems: 'center', gap: '1rem' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800' }}>{item.name}</p>
                                            <span style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.4 }}>SKU: {item.sku} • Stock Origen: {branchStock[item.product_id] || 0}</span>
                                        </div>
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

                {/* Footer */}
                <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid hsl(var(--border) / 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '900', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Traspaso</p>
                        <h3 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900', color: 'hsl(var(--primary))' }}>{totalItems} <span style={{ fontSize: '1rem', opacity: 0.5 }}>uds.</span></h3>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {error && (
                            <div style={{ color: 'hsl(var(--destructive))', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}
                        <button onClick={onClose} style={{ padding: '0.8rem 1.5rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', backgroundColor: 'white', fontWeight: '800', cursor: 'pointer' }}>CANCELAR</button>
                        {!readOnly && (
                            <button 
                                onClick={handleSubmit}
                                disabled={isSaving || items.length === 0}
                                style={{ padding: '0.8rem 2rem', borderRadius: '12px', border: 'none', backgroundColor: 'hsl(var(--primary))', color: 'white', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', opacity: (isSaving || items.length === 0) ? 0.5 : 1 }}
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                                {initialData ? 'GUARDAR CAMBIOS' : 'FINALIZAR TRASPASO'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
