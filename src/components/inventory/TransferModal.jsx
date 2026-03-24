import React, { useState, useEffect, useMemo } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, ArrowRight, Building2, Package, MapPin, ChevronRight, Info, ArrowLeftRight, Box, Layers } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function TransferModal({ onClose, onSave, isSaving, initialData = null, readOnly = false }) {
     const [branches, setBranches] = useState([])
    const [products, setProducts] = useState([])
    const [brands, setBrands] = useState([])
    const [selectedBrand, setSelectedBrand] = useState(null)
    const [branchStock, setBranchStock] = useState({})
    const [originBranch, setOriginBranch] = useState(initialData?.origin_branch_id || '')
    const [destBranch, setDestBranch] = useState(initialData?.destination_branch_id || '')
    const [items, setItems] = useState(initialData?.items || [])
    const [searchTerm, setSearchTerm] = useState('')
    const [showProductSearch, setShowProductSearch] = useState(false)
    const [error, setError] = useState(null)

    async function fetchInitialData() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            const isUserAdmin = profile?.role === 'Administrador'

            // 1. Get branch assignments
            const { data: assignments } = await supabase
                .from('user_branches')
                .select('branch_id')
                .eq('user_id', user.id)

            const assignedIds = assignments?.map(a => a.branch_id) || []

            // 2. Fetch all required data
            const [branchesRes, productsRes, brandsRes] = await Promise.all([
                supabase.from('branches').select('*').eq('active', true).order('name'),
                supabase.from('products').select(`
                    *,
                    category:categories(name),
                    brand:brands(name)
                `).eq('active', true).order('name'),
                supabase.from('brands').select('*').order('name')
            ])

            // 3. Filter branches for the user
            let availableBranches = branchesRes.data || []
            if (!isUserAdmin && assignedIds.length > 0) {
                availableBranches = availableBranches.filter(b => assignedIds.includes(b.id))
            }

            setBranches(availableBranches)
            setProducts(productsRes.data || [])
            setBrands(brandsRes.data || [])


            // 4. Fetch and apply default branch setting
            const { data: defaultSetting } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'default_purchase_branch')
                .maybeSingle()

            if (!initialData && availableBranches.length > 0) {
                const defaultId = defaultSetting ? parseInt(defaultSetting.value) : null
                const exists = availableBranches.find(b => b.id === defaultId)

                if (exists) {
                    setOriginBranch(defaultId)
                    // If destination is same as default origin, pick different destination if possible
                    if (availableBranches[0].id === defaultId && availableBranches.length > 1) {
                        setDestBranch(availableBranches[1].id)
                    } else {
                        setDestBranch(availableBranches[0].id)
                    }
                } else {
                    setOriginBranch(availableBranches[0].id)
                    if (availableBranches.length > 1) {
                        setDestBranch(availableBranches[1].id)
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching initial data:', err)
        }
    }

    async function fetchBranchStock() {
        try {
            const { data } = await supabase
                .from('product_branch_settings')
                .select('product_id, stock')
                .eq('branch_id', originBranch)

            if (data) {
                const stockMap = {}
                data.forEach(item => {
                    stockMap[item.product_id] = item.stock
                })
                setBranchStock(stockMap)

                // Update current items stock display
                setItems(prev => prev.map(item => ({
                    ...item,
                    current_stock: stockMap[item.product_id] || 0
                })))
            } else {
                setBranchStock({})
            }
        } catch (err) {
            console.error('Error fetching stock:', err)
        }
    }

    useEffect(() => {
        fetchInitialData()
    }, [])

    useEffect(() => {
        if (originBranch) {
            fetchBranchStock()
        }
    }, [originBranch])

    const addItem = (product) => {
        setItems(prev => {
            const existing = prev.find(i => i.product_id === product.id)
            if (existing) return prev
            return [...prev, {
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                category_name: product.category?.name,
                display_quantity: 1,
                unit_type: 'UNIDAD',
                units_per_box: 1,
                current_stock: branchStock[product.id] || 0
            }]
        })
        setShowProductSearch(false)
        setSearchTerm('')
    }

    const removeItem = (productId) => {
        setItems(prev => prev.filter(i => i.product_id !== productId))
    }

    const updateItem = (productId, field, value) => {
        setItems(prev => prev.map(item => {
            if (item.product_id !== productId) return item
            const updates = { ...item }
            if (field === 'display_quantity') {
                // Permitimos 0 temporalmente para borrar/escribir
                updates.display_quantity = Math.max(0, parseInt(value) || 0)
            } else if (field === 'unit_type') {
                updates.unit_type = value
                if (value === 'UNIDAD') updates.units_per_box = 1
                else if (value === 'CAJA' && updates.units_per_box === 1) updates.units_per_box = 12
            } else if (field === 'units_per_box') {
                updates.units_per_box = Math.max(0, parseInt(value) || 0)
            }
            return updates
        }))
    }

    const totalUnits = useMemo(() => items.reduce((acc, item) => acc + (item.display_quantity * item.units_per_box), 0), [items])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!originBranch || !destBranch) return setError('Seleccione ambas sucursales para el traspaso.')
        if (originBranch === destBranch) return setError('La sucursal de origen y destino no pueden ser la misma.')
        if (items.length === 0) return setError('Indique al menos un producto para traspasar.')

        for (const item of items) {
            const totalQty = item.display_quantity * item.units_per_box
            if (totalQty > item.current_stock) {
                return setError(`Stock insuficiente para "${item.name}" en origen. Disp: ${item.current_stock}, Req: ${totalQty}`)
            }
        }

        const formattedItems = items.map(item => ({
            product_id: item.product_id,
            quantity: item.display_quantity * item.units_per_box
        }))

        onSave({
            origin_branch_id: originBranch,
            destination_branch_id: destBranch,
            items: formattedItems
        })
    }

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.sku?.toLowerCase().includes(searchTerm.toLowerCase())

            if (selectedBrand) {
                return p.brand_id === selectedBrand.id && matchesSearch
            }
            return matchesSearch
        })
    }, [products, searchTerm, selectedBrand])

    // Styles
    const sectionTitleStyle = {
        fontSize: '0.875rem',
        fontWeight: '700',
        color: 'hsl(var(--primary))',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    }

    const inputStyle = {
        width: '100%',
        padding: '0.6rem 0.8rem',
        borderRadius: '10px',
        border: '1px solid hsl(var(--border) / 0.6)',
        backgroundColor: 'hsl(var(--secondary) / 0.2)',
        fontSize: '0.875rem',
        outline: 'none',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start'
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
        }}>
            <div className="card shadow-2xl" style={{
                width: '100%',
                maxWidth: '1000px',
                padding: 0,
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '20px',
                overflow: 'hidden',
                backgroundColor: 'hsl(var(--background))'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid hsl(var(--border) / 0.6)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'hsl(var(--secondary) / 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            padding: '0.6rem',
                            backgroundColor: 'hsl(var(--primary) / 0.1)',
                            color: 'hsl(var(--primary))',
                            borderRadius: '12px'
                        }}>
                            <ArrowLeftRight size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                                {initialData ? (readOnly ? 'Detalles del Traspaso' : 'Modificar Traspaso') : 'Nuevo Traspaso Local'}
                            </h2>
                            <p style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Mueva mercadería entre sus puntos de venta</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }} disabled={isSaving}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                    {error && (
                        <div style={{ padding: '1rem', backgroundColor: 'hsl(var(--destructive) / 0.08)', color: 'hsl(var(--destructive))', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid hsl(var(--destructive) / 0.1)' }}>
                            <AlertCircle size={18} />
                            <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        {/* Flow Selection Section */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.05)', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.4)', position: 'relative' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <MapPin size={14} style={{ color: 'hsl(var(--secondary-foreground) / 0.5)' }} />
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.6 }}>Origen del Stock</label>
                                </div>
                                <select
                                    style={{ ...inputStyle, cursor: readOnly ? 'default' : 'pointer', fontWeight: '700', backgroundColor: readOnly ? 'transparent' : 'hsl(var(--secondary) / 0.2)' }}
                                    value={originBranch}
                                    onChange={(e) => setOriginBranch(e.target.value)}
                                    disabled={readOnly}
                                    required
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                backgroundColor: 'white',
                                border: '1px solid hsl(var(--border) / 0.6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'hsl(var(--primary))',
                                marginTop: '1.2rem',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                            }}>
                                <ArrowRight size={20} />
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <MapPin size={14} style={{ color: 'hsl(var(--primary) / 0.6)' }} />
                                    <label style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.6 }}>Destino de la Mercadería</label>
                                </div>
                                <select
                                    style={{ ...inputStyle, cursor: readOnly ? 'default' : 'pointer', fontWeight: '700', backgroundColor: readOnly ? 'transparent' : 'hsl(var(--secondary) / 0.2)' }}
                                    value={destBranch}
                                    onChange={(e) => setDestBranch(e.target.value)}
                                    disabled={readOnly}
                                    required
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Items Section */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h3 style={{ ...sectionTitleStyle, marginBottom: 0 }}><Package size={18} /> Productos a Trasladar</h3>

                                <div style={{ position: 'relative' }}>
                                    {!readOnly && (
                                        <button
                                            type="button"
                                            className="btn btn-primary shadow-sm"
                                            onClick={() => setShowProductSearch(!showProductSearch)}
                                            style={{ borderRadius: '10px', gap: '0.6rem', padding: '0.6rem 1.2rem', fontWeight: '700' }}
                                        >
                                            <Plus size={18} />
                                            Agregar Producto
                                        </button>
                                    )}
                                     {showProductSearch && (
                                        <div style={{
                                            position: 'fixed',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            backgroundColor: 'rgba(0,0,0,0.3)',
                                            backdropFilter: 'blur(4px)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 200,
                                            padding: '2rem'
                                        }} onClick={() => setShowProductSearch(false)}>
                                            <div className="card shadow-2xl" style={{
                                                width: '100%',
                                                maxWidth: '800px',
                                                maxHeight: '80vh',
                                                padding: 0,
                                                borderRadius: '24px',
                                                overflow: 'hidden',
                                                border: '1px solid hsl(var(--border) / 0.8)',
                                                backgroundColor: 'hsl(var(--background))',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                                            }} onClick={(e) => e.stopPropagation()}>
                                                {/* Search Header */}
                                                <div style={{
                                                    padding: '1.5rem',
                                                    borderBottom: '1px solid hsl(var(--border) / 0.5)',
                                                    backgroundColor: 'hsl(var(--secondary) / 0.15)',
                                                    display: 'flex',
                                                    gap: '1rem',
                                                    alignItems: 'center'
                                                }}>
                                                    <div style={{ position: 'relative', flex: 1 }}>
                                                        <Search size={22} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder={selectedBrand ? `Buscar en ${selectedBrand.name}...` : "Buscar producto por modelo, nombre o SKU..."}
                                                            style={{
                                                                width: '100%',
                                                                padding: '1rem 1.25rem 1rem 3.5rem',
                                                                borderRadius: '16px',
                                                                border: '2px solid hsl(var(--primary) / 0.1)',
                                                                backgroundColor: 'white',
                                                                fontSize: '1.1rem',
                                                                fontWeight: '600',
                                                                outline: 'none',
                                                                color: 'hsl(var(--foreground))',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onFocus={(e) => e.target.style.borderColor = 'hsl(var(--primary) / 0.3)'}
                                                            onBlur={(e) => e.target.style.borderColor = 'hsl(var(--primary) / 0.1)'}
                                                            value={searchTerm}
                                                            onChange={(e) => setSearchTerm(e.target.value)}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowProductSearch(false)}
                                                        style={{
                                                            padding: '0.75rem',
                                                            borderRadius: '14px',
                                                            border: 'none',
                                                            backgroundColor: 'hsl(var(--secondary) / 0.2)',
                                                            color: 'hsl(var(--foreground))',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                </div>

                                                {/* Brand Selection Area */}
                                                {!selectedBrand && !searchTerm && (
                                                    <div style={{ padding: '1.5rem', borderBottom: '1px solid hsl(var(--border) / 0.3)', backgroundColor: 'hsl(var(--secondary) / 0.05)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                                            <p style={{ fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.5, letterSpacing: '0.1em' }}>NAVEGAR POR MARCA</p>
                                                            <Layers size={16} style={{ opacity: 0.3 }} />
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                                                            {brands.map(brand => (
                                                                <button
                                                                    key={brand.id}
                                                                    type="button"
                                                                    className="brand-card"
                                                                    onClick={() => setSelectedBrand(brand)}
                                                                    style={{
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        alignItems: 'center',
                                                                        gap: '0.75rem',
                                                                        padding: '1rem 0.6rem',
                                                                        borderRadius: '18px',
                                                                        border: '1px solid hsl(var(--border) / 0.6)',
                                                                        backgroundColor: 'white',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s'
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        width: '50px',
                                                                        height: '50px',
                                                                        borderRadius: '12px',
                                                                        backgroundColor: 'hsl(var(--secondary) / 0.4)',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        overflow: 'hidden',
                                                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                                                    }}>
                                                                        {brand.logo_url ? (
                                                                            <img src={brand.logo_url} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
                                                                        ) : (
                                                                            <Building2 size={24} style={{ opacity: 0.3 }} />
                                                                        )}
                                                                    </div>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', textAlign: 'center', color: 'hsl(var(--foreground))' }}>{brand.name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Selected Brand indicator */}
                                                {selectedBrand && !searchTerm && (
                                                    <div style={{ padding: '0.75rem 1.5rem', backgroundColor: 'hsl(var(--primary) / 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(var(--primary) / 0.1)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                {selectedBrand.logo_url ? <img src={selectedBrand.logo_url} style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : <Building2 size={12} />}
                                                            </div>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'hsl(var(--primary))' }}>{selectedBrand.name}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedBrand(null)}
                                                            style={{ fontSize: '0.75rem', fontWeight: '800', color: 'hsl(var(--secondary-foreground))', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer' }}
                                                        >
                                                            Cambiar Marca
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Results List */}
                                                <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'hsl(var(--background))' }}>
                                                    {filteredProducts.length === 0 ? (
                                                        <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
                                                            <div style={{
                                                                width: '64px',
                                                                height: '64px',
                                                                borderRadius: '20px',
                                                                backgroundColor: 'hsl(var(--secondary) / 0.3)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                margin: '0 auto 1.5rem'
                                                            }}>
                                                                <Search size={32} style={{ opacity: 0.2 }} />
                                                            </div>
                                                            <p style={{ fontSize: '1rem', fontWeight: '800', color: 'hsl(var(--foreground))', margin: 0 }}>No se encontraron coincidencias</p>
                                                            <p style={{ fontSize: '0.85rem', fontWeight: '500', opacity: 0.4, marginTop: '0.5rem' }}>Intente con otros términos de búsqueda</p>
                                                        </div>
                                                    ) : (
                                                        <div style={{ padding: '0.5rem' }}>
                                                            {filteredProducts.map(p => {
                                                                const currentStock = branchStock[p.id] || 0

                                                                return (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        className="search-item"
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '1rem 1.25rem',
                                                                            border: 'none',
                                                                            borderRadius: '16px',
                                                                            transition: 'all 0.2s',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '1.25rem',
                                                                            textAlign: 'left',
                                                                            backgroundColor: 'transparent',
                                                                            cursor: 'pointer',
                                                                            marginBottom: '0.25rem'
                                                                        }}
                                                                        onClick={() => addItem(p)}
                                                                    >
                                                                        <div style={{
                                                                            width: '56px',
                                                                            height: '56px',
                                                                            borderRadius: '14px',
                                                                            backgroundColor: 'hsl(var(--secondary) / 0.4)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            backgroundImage: p.image_url ? `url(${p.image_url})` : 'none',
                                                                            backgroundSize: 'cover',
                                                                            backgroundPosition: 'center',
                                                                            flexShrink: 0,
                                                                            border: '1px solid hsl(var(--border) / 0.4)'
                                                                        }}>
                                                                            {!p.image_url && <Package size={28} style={{ opacity: 0.2 }} />}
                                                                        </div>

                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                                                <p style={{ fontWeight: '900', fontSize: '1rem', margin: 0, color: 'hsl(var(--foreground))' }}>{p.name}</p>
                                                                                <div style={{
                                                                                    padding: '4px 10px',
                                                                                    borderRadius: '8px',
                                                                                    backgroundColor: currentStock > 0 ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--destructive) / 0.08)',
                                                                                    color: currentStock > 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
                                                                                    fontSize: '0.75rem',
                                                                                    fontWeight: '850',
                                                                                    letterSpacing: '0.02em',
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '4px'
                                                                                }}>
                                                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                                                                                    Stock en Origen: {currentStock}
                                                                                </div>
                                                                            </div>

                                                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'hsl(var(--secondary-foreground) / 0.5)', backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '2px 8px', borderRadius: '6px' }}>
                                                                                    SKU: {p.sku || '---'}
                                                                                </div>
                                                                                {p.brand?.name && (
                                                                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'hsl(var(--primary))' }}>
                                                                                        {p.brand.name}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div style={{
                                                                            width: '32px',
                                                                            height: '32px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: 'hsl(var(--primary) / 0.1)',
                                                                            color: 'hsl(var(--primary))',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            opacity: 0,
                                                                            transition: 'all 0.2s',
                                                                            transform: 'translateX(-10px)'
                                                                        }} className="add-affordance">
                                                                            <Plus size={18} />
                                                                        </div>
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>

                            <div className="card" style={{ padding: 0, overflowX: 'auto', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Producto</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '130px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Formato</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '100px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Cantidad</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '100px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Uds./Caja</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '130px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Total Unidades</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody style={{ backgroundColor: 'hsl(var(--background))' }}>
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ padding: '4rem', textAlign: 'center' }}>
                                                    <div style={{ opacity: 0.2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <Box size={48} />
                                                        <p style={{ fontWeight: '700', marginTop: '1rem' }}>No hay ítems seleccionados para el traslado.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map(item => (
                                                <tr key={item.product_id} style={{ borderTop: '1px solid hsl(var(--border) / 0.3)' }}>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Package size={20} opacity={0.4} />
                                                            </div>
                                                            <div>
                                                                <p style={{ fontWeight: '700', fontSize: '0.9rem', margin: 0 }}>{item.name}</p>
                                                                <p style={{ fontSize: '0.7rem', opacity: 0.5, margin: 0 }}>SKU: {item.sku} • Disp: <span style={{ fontWeight: '700', color: 'hsl(var(--primary))' }}>{item.current_stock}</span></p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', padding: '4px', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '8px', gap: '2px', opacity: readOnly ? 0.6 : 1 }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => !readOnly && updateItem(item.product_id, 'unit_type', 'UNIDAD')}
                                                                style={{ flex: 1, padding: '4px', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.2s', backgroundColor: item.unit_type === 'UNIDAD' ? 'hsl(var(--background))' : 'transparent', color: item.unit_type === 'UNIDAD' ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground))' }}
                                                            >UId.</button>
                                                            <button
                                                                type="button"
                                                                onClick={() => !readOnly && updateItem(item.product_id, 'unit_type', 'CAJA')}
                                                                style={{ flex: 1, padding: '4px', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.2s', backgroundColor: item.unit_type === 'CAJA' ? 'hsl(var(--background))' : 'transparent', color: item.unit_type === 'CAJA' ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground))' }}
                                                            >Caja</button>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={item.display_quantity === 0 ? '' : item.display_quantity}
                                                            onChange={(e) => updateItem(item.product_id, 'display_quantity', e.target.value)}
                                                            onFocus={(e) => !readOnly && e.target.select()}
                                                            onBlur={() => { if (!readOnly && item.display_quantity === 0) updateItem(item.product_id, 'display_quantity', 1) }}
                                                            disabled={readOnly}
                                                            className="form-input"
                                                            style={{ ...inputStyle, textAlign: 'center', backgroundColor: readOnly ? 'transparent' : 'white' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        {item.unit_type === 'CAJA' ? (
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.units_per_box === 0 ? '' : item.units_per_box}
                                                                onChange={(e) => updateItem(item.product_id, 'units_per_box', e.target.value)}
                                                                onFocus={(e) => !readOnly && e.target.select()}
                                                                onBlur={() => { if (!readOnly && item.units_per_box === 0) updateItem(item.product_id, 'units_per_box', 1) }}
                                                                disabled={readOnly}
                                                                className="form-input"
                                                                style={{ ...inputStyle, textAlign: 'center', backgroundColor: readOnly ? 'transparent' : 'white' }}
                                                            />
                                                        ) : (
                                                            <div style={{ textAlign: 'center', opacity: 0.2 }}>---</div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', fontSize: '0.95rem' }}>
                                                        {item.display_quantity * item.units_per_box} uds.
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        {!readOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(item.product_id)}
                                                                style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)', border: 'none', color: 'hsl(var(--destructive))', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', alignItems: 'flex-end', marginTop: '1rem' }}>
                            <div style={{ padding: '1.25rem', backgroundColor: 'hsl(var(--primary) / 0.03)', borderRadius: '16px', border: '2px dashed hsl(var(--primary) / 0.2)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ color: 'hsl(var(--primary))' }}><Info size={24} /></div>
                                <p style={{ fontSize: '0.8rem', fontWeight: '500', margin: 0, opacity: 0.7 }}>
                                    Importante: El traspaso requiere una confirmación de salida en origen y una validación de recepción en destino para completar el movimiento de stock.
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '1rem', fontWeight: '700', opacity: 0.5 }}>Total a Trasladar:</span>
                                    <span style={{ fontSize: '1.8rem', fontWeight: '900', color: 'hsl(var(--foreground))' }}>{totalUnits} <span style={{ fontSize: '1rem', opacity: 0.5 }}>unidades</span></span>
                                </div>
                                {!readOnly && (
                                    <button
                                        type="submit"
                                        className="btn btn-primary shadow-xl shadow-primary/20"
                                        disabled={isSaving}
                                        style={{ padding: '1rem', borderRadius: '14px', gap: '0.75rem', fontSize: '1rem', fontWeight: '800' }}
                                    >
                                        {isSaving ? (
                                            <><Loader2 size={24} className="animate-spin" /> PROCESANDO SOLICITUD...</>
                                        ) : (
                                            <><Save size={24} /> {initialData ? 'GUARDAR MODIFICACIONES' : 'CREAR SOLICITUD DE TRASPASO'}</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            <style>{`
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .search-item:hover {
                    background-color: hsl(var(--secondary) / 0.15) !important;
                }
                .search-item:hover .add-affordance {
                    opacity: 1 !important;
                    transform: translateX(0) !important;
                }
                .brand-card:hover {
                    transform: translateY(-4px);
                    border-color: hsl(var(--primary) / 0.4) !important;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                }
            `}</style>
        </div>
    )
}
