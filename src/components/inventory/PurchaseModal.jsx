import React, { useState, useEffect, useMemo } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, Truck, Building2, Package, ShoppingCart, Info, ChevronRight, Layers } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function PurchaseModal({ onClose, onSave, isSaving, initialData, currencySymbol = 'Bs.', readOnly = false }) {
    const [suppliers, setSuppliers] = useState([])
    const [branches, setBranches] = useState([])
    const [products, setProducts] = useState([])
    const [brands, setBrands] = useState([])
    const [selectedBrand, setSelectedBrand] = useState(null)
    const [selectedSupplier, setSelectedSupplier] = useState(initialData?.supplier_id || '')
    const [selectedBranch, setSelectedBranch] = useState(initialData?.branch_id || '')
    const [items, setItems] = useState(initialData?.items || [])
    const [searchTerm, setSearchTerm] = useState('')
    const [showProductSearch, setShowProductSearch] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetchInitialData() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                // 1. Get branch assignments
                const { data: assignments } = await supabase
                    .from('user_branches')
                    .select('branch_id')
                    .eq('user_id', user.id)

                const assignedIds = assignments?.map(a => a.branch_id) || []

                // 2. Fetch all required data
                const [suppliersRes, branchesRes, productsRes, brandsRes] = await Promise.all([
                    supabase.from('suppliers').select('*').order('name'),
                    supabase.from('branches').select('*').eq('active', true).order('name'),
                    supabase.from('products').select(`
                        *,
                        category:categories(name),
                        brand:brands(name),
                        model:models(name),
                        product_branch_settings(stock, branch_id)
                    `).eq('active', true).order('name'),
                    supabase.from('brands').select('*').order('name')
                ])

                setSuppliers(suppliersRes.data || [])
                setProducts(productsRes.data || [])
                setBrands(brandsRes.data || [])

                // 3. Filter branches
                let finalBranches = branchesRes.data || []
                if (assignedIds.length > 0) {
                    finalBranches = finalBranches.filter(b => assignedIds.includes(b.id))
                }
                setBranches(finalBranches)

                // 4. Fetch and apply default branch setting
                const { data: defaultSetting } = await supabase
                    .from('settings')
                    .select('value')
                    .eq('key', 'default_purchase_branch')
                    .maybeSingle()

                if (!initialData && finalBranches.length > 0) {
                    const defaultId = defaultSetting ? parseInt(defaultSetting.value) : null
                    const exists = finalBranches.find(b => b.id === defaultId)
                    if (exists) {
                        setSelectedBranch(defaultId)
                    } else {
                        setSelectedBranch(finalBranches[0].id)
                    }
                }
            } catch (err) {
                console.error(err)
            }
        }
        fetchInitialData()
    }, [initialData])

    const addItem = (product) => {
        setItems(prev => {
            const existing = prev.find(i => i.product_id === product.id)
            if (existing) return prev
            return [...prev, {
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                category_name: product.category?.name,
                brand_name: product.brand?.name,
                model_name: product.model?.name,
                quantity: 1,
                unit_cost: product.price || 0,
                total: product.price || 0,
                is_pack: false,
                units_per_pack: 12
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
            if (item.product_id === productId) {
                const updated = { ...item }

                if (field === 'is_pack') {
                    updated.is_pack = value
                } else if (field === 'units_per_pack' || field === 'quantity') {
                    updated[field] = Math.max(0, parseFloat(value) || 0)
                } else if (field === 'unit_cost') {
                    updated[field] = Math.max(0, parseFloat(value) || 0)
                }

                updated.total = updated.quantity * updated.unit_cost
                return updated
            }
            return item
        }))
    }

    const total = useMemo(() => items.reduce((acc, item) => acc + item.total, 0), [items])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!selectedBranch) return setError('Seleccione la sucursal de destino.')
        if (items.length === 0) return setError('Debe agregar al menos un producto a la compra.')

        const processedItems = items.map(item => {
            const finalQuantity = item.is_pack ? (item.quantity * item.units_per_pack) : item.quantity
            const finalUnitCost = item.is_pack ? (item.unit_cost / item.units_per_pack) : item.unit_cost

            return {
                ...item,
                quantity: finalQuantity,
                unit_cost: finalUnitCost,
            }
        })

        onSave({
            supplier_id: selectedSupplier || null,
            branch_id: selectedBranch,
            total,
            items: processedItems
        })
    }

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.model?.name && p.model.name.toLowerCase().includes(searchTerm.toLowerCase()))

            if (selectedBrand) {
                return p.brand_id === selectedBrand.id && matchesSearch
            }
            return matchesSearch
        })
    }, [products, searchTerm, selectedBrand])

    // Styles
    const sectionTitleStyle = {
        fontSize: '0.9rem',
        fontWeight: '800',
        color: 'hsl(var(--primary))',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        marginBottom: '1.25rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em'
    }

    const labelStyle = {
        fontSize: '0.75rem',
        fontWeight: '700',
        color: 'hsl(var(--secondary-foreground) / 0.7)',
        marginBottom: '0.4rem',
        display: 'block'
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
        justifyContent: 'flex-start',
        cursor: 'text'
    }

    return (
        <>
            <style>
                {`
                    @keyframes modalFadeIn {
                        from { opacity: 0; transform: translateY(20px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    @keyframes scaleIn {
                        from { opacity: 0; transform: scale(0.9) translateY(10px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    .search-item:hover {
                        background-color: hsl(var(--primary) / 0.05) !important;
                        transform: translateX(4px);
                    }
                    .brand-card:hover {
                        border-color: hsl(var(--primary) / 0.4) !important;
                        background-color: hsl(var(--primary) / 0.03) !important;
                        transform: translateY(-2px);
                    }
                    .search-item:hover .add-affordance {
                        opacity: 1 !important;
                        transform: translateX(0) !important;
                    }
                `}
            </style>
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
                    maxWidth: '1200px',
                    padding: 0,
                    maxHeight: '94vh',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border) / 0.8)',
                    animation: 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '1.75rem 2.5rem',
                        borderBottom: '1px solid hsl(var(--border) / 0.6)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'linear-gradient(to bottom, hsl(var(--secondary) / 0.15), transparent)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                padding: '0.75rem',
                                background: 'linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))',
                                color: 'hsl(var(--primary))',
                                borderRadius: '16px',
                                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)'
                            }}>
                                <ShoppingCart size={28} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <h2 style={{ fontSize: '1.6rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em', color: 'hsl(var(--foreground))' }}>
                                        {initialData ? (readOnly ? 'Detalles de Ingreso' : 'Modificar Ingreso') : 'Cargar Inventario'}
                                    </h2>
                                    {readOnly && (
                                        <span style={{
                                            fontSize: '0.7rem',
                                            backgroundColor: 'hsl(var(--secondary))',
                                            color: 'hsl(var(--secondary-foreground) / 0.6)',
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            border: '1px solid hsl(var(--border) / 0.5)'
                                        }}>
                                            Modo Consulta
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.85rem', fontWeight: '600', opacity: 0.5, margin: 0, letterSpacing: '0.01em' }}>
                                    {readOnly ? 'Visualización de registros históricos de mercadería' : 'Gestión de entrada de mercadería al inventario central'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="btn"
                            style={{
                                padding: '0.6rem',
                                borderRadius: '50%',
                                backgroundColor: 'hsl(var(--secondary) / 0.2)',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--destructive) / 0.1)'; e.currentTarget.style.color = 'hsl(var(--destructive))'; e.currentTarget.style.transform = 'rotate(90deg)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.2)'; e.currentTarget.style.color = 'inherit'; e.currentTarget.style.transform = 'rotate(0deg)' }}
                            disabled={isSaving}
                        >
                            <X size={22} />
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

                            {/* Context Section */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.5fr 1fr',
                                gap: '2.5rem',
                                padding: '2rem',
                                backgroundColor: 'hsl(var(--secondary) / 0.05)',
                                borderRadius: '20px',
                                border: '1px solid hsl(var(--border) / 0.4)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                            }}>
                                <div>
                                    <h3 style={sectionTitleStyle}><Truck size={18} /> Proveedor</h3>
                                    <div style={{ position: 'relative' }}>
                                        <Truck size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                        <select
                                            style={{ ...inputStyle, paddingLeft: '2.5rem', backgroundColor: readOnly ? 'hsl(var(--secondary) / 0.1)' : 'hsl(var(--secondary) / 0.2)' }}
                                            value={selectedSupplier}
                                            onChange={(e) => setSelectedSupplier(e.target.value)}
                                            disabled={readOnly}
                                        >
                                            <option value="">(Opcional) Seleccione el proveedor...</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} {s.nit ? `(${s.nit})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <h3 style={sectionTitleStyle}><Building2 size={18} /> Destino</h3>
                                    <div style={{ position: 'relative' }}>
                                        <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                        <select
                                            style={{ ...inputStyle, paddingLeft: '2.5rem', backgroundColor: readOnly ? 'hsl(var(--secondary) / 0.1)' : 'hsl(var(--secondary) / 0.2)' }}
                                            value={selectedBranch}
                                            onChange={(e) => setSelectedBranch(e.target.value)}
                                            disabled={readOnly}
                                            required
                                        >
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Items Section */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                    <h3 style={{ ...sectionTitleStyle, marginBottom: 0 }}><Package size={18} /> Detalle de Ítems</h3>

                                    <div style={{ position: 'relative' }}>
                                        {!readOnly && (
                                            <button
                                                type="button"
                                                className="btn btn-primary shadow-lg"
                                                onClick={() => setShowProductSearch(!showProductSearch)}
                                                style={{
                                                    borderRadius: '12px',
                                                    gap: '0.75rem',
                                                    padding: '0.75rem 1.75rem',
                                                    fontWeight: '800',
                                                    background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.9))',
                                                    border: 'none',
                                                    transition: 'all 0.2s',
                                                    transform: showProductSearch ? 'scale(0.98)' : 'scale(1)'
                                                }}
                                            >
                                                <Plus size={20} />
                                                AGREGAR PRODUCTO
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
                                                                    const branchSettings = p.product_branch_settings?.find(s => s.branch_id === selectedBranch)
                                                                    const currentStock = branchSettings ? branchSettings.stock : 0

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
                                                                                        Stock: {currentStock}
                                                                                    </div>
                                                                                </div>

                                                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'hsl(var(--secondary-foreground) / 0.5)', backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '2px 8px', borderRadius: '6px' }}>
                                                                                        SKU: {p.sku || '---'}
                                                                                    </div>
                                                                                    {p.model?.name && (
                                                                                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'hsl(var(--primary))' }}>
                                                                                            {p.model.name}
                                                                                        </span>
                                                                                    )}
                                                                                    {!selectedBrand && p.brand?.name && (
                                                                                        <>
                                                                                            <span style={{ fontSize: '0.8rem', opacity: 0.1 }}>|</span>
                                                                                            <span style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.5 }}>{p.brand.name}</span>
                                                                                        </>
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

                                <div className="card shadow-sm" style={{
                                    padding: 0,
                                    overflowX: 'auto',
                                    borderRadius: '20px',
                                    border: '1px solid hsl(var(--border) / 0.6)',
                                    backgroundColor: 'hsl(var(--background))'
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'hsl(var(--secondary) / 0.25)' }}>
                                                <th style={{ padding: '1.25rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '850', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.1em', borderBottom: '2px solid hsl(var(--border) / 0.4)' }}>Producto</th>
                                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center', width: '130px', fontSize: '0.75rem', fontWeight: '850', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.1em', borderBottom: '2px solid hsl(var(--border) / 0.4)' }}>Modo</th>
                                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center', width: '110px', fontSize: '0.75rem', fontWeight: '850', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.1em', borderBottom: '2px solid hsl(var(--border) / 0.4)' }}>Cant.</th>
                                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center', width: '110px', fontSize: '0.75rem', fontWeight: '850', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.1em', borderBottom: '2px solid hsl(var(--border) / 0.4)' }}>Uds./Caja</th>
                                                <th style={{ padding: '1.25rem 1rem', textAlign: 'center', width: '140px', fontSize: '0.75rem', fontWeight: '850', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.1em', borderBottom: '2px solid hsl(var(--border) / 0.4)' }}>Costo {currencySymbol}</th>
                                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right', width: '140px', fontSize: '0.75rem', fontWeight: '850', textTransform: 'uppercase', opacity: 0.6, letterSpacing: '0.1em', borderBottom: '2px solid hsl(var(--border) / 0.4)' }}>Subtotal</th>
                                                <th style={{ padding: '1.25rem 1rem', textAlign: 'right', width: '60px', borderBottom: '2px solid hsl(var(--border) / 0.4)' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody style={{ backgroundColor: 'hsl(var(--background))' }}>
                                            {items.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" style={{ padding: '4rem', textAlign: 'center' }}>
                                                        <div style={{ opacity: 0.2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                            <Plus size={48} />
                                                            <p style={{ fontWeight: '700', marginTop: '1rem' }}>Lista vacía. Comience agregando productos.</p>
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
                                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{item.sku}</span>
                                                                        {item.is_pack && (
                                                                            <span style={{ fontSize: '0.65rem', padding: '1px 6px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '4px', fontWeight: '700' }}>
                                                                                Ingresarán {item.quantity * item.units_per_pack} uds.
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ display: 'flex', padding: '4px', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '8px', gap: '2px', opacity: readOnly ? 0.7 : 1 }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => !readOnly && updateItem(item.product_id, 'is_pack', false)}
                                                                    style={{ flex: 1, padding: '4px', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.2s', backgroundColor: !item.is_pack ? 'hsl(var(--background))' : 'transparent', color: !item.is_pack ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground))', boxShadow: !item.is_pack ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                                                                >UId.</button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => !readOnly && updateItem(item.product_id, 'is_pack', true)}
                                                                    style={{ flex: 1, padding: '4px', border: 'none', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.2s', backgroundColor: item.is_pack ? 'hsl(var(--background))' : 'transparent', color: item.is_pack ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground))', boxShadow: item.is_pack ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                                                                >Caja</button>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={item.quantity === 0 ? '' : item.quantity}
                                                                onChange={(e) => updateItem(item.product_id, 'quantity', e.target.value)}
                                                                onFocus={(e) => !readOnly && e.target.select()}
                                                                onBlur={() => { if (!readOnly && item.quantity === 0) updateItem(item.product_id, 'quantity', 1) }}
                                                                disabled={readOnly}
                                                                className="form-input"
                                                                style={{ ...inputStyle, textAlign: 'center', backgroundColor: readOnly ? 'transparent' : 'white' }}
                                                            />
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            {item.is_pack ? (
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.units_per_pack === 0 ? '' : item.units_per_pack}
                                                                    onChange={(e) => updateItem(item.product_id, 'units_per_pack', e.target.value)}
                                                                    onFocus={(e) => !readOnly && e.target.select()}
                                                                    onBlur={() => { if (!readOnly && item.units_per_pack === 0) updateItem(item.product_id, 'units_per_pack', 1) }}
                                                                    disabled={readOnly}
                                                                    className="form-input"
                                                                    style={{ ...inputStyle, textAlign: 'center', backgroundColor: readOnly ? 'transparent' : 'white' }}
                                                                />
                                                            ) : (
                                                                <div style={{ textAlign: 'center', opacity: 0.2 }}>---</div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '1rem' }}>
                                                            <div style={{ position: 'relative' }}>
                                                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.3 }}>{currencySymbol}</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={item.unit_cost === 0 ? '' : item.unit_cost}
                                                                    onChange={(e) => updateItem(item.product_id, 'unit_cost', e.target.value)}
                                                                    onFocus={(e) => !readOnly && e.target.select()}
                                                                    onBlur={() => { if (!readOnly && item.unit_cost === 0) updateItem(item.product_id, 'unit_cost', 0) }}
                                                                    disabled={readOnly}
                                                                    className="form-input"
                                                                    style={{ ...inputStyle, textAlign: 'center', backgroundColor: readOnly ? 'transparent' : 'white', paddingLeft: '1.4rem' }}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800', fontSize: '0.95rem' }}>
                                                            {currencySymbol}{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.5fr 1fr',
                                gap: '3rem',
                                alignItems: 'center',
                                marginTop: '1.5rem',
                                padding: '2rem',
                                backgroundColor: 'hsl(var(--secondary) / 0.05)',
                                borderRadius: '24px',
                                border: '1px solid hsl(var(--border) / 0.4)'
                            }}>
                                <div style={{
                                    padding: '1.5rem',
                                    backgroundColor: 'hsl(var(--primary) / 0.05)',
                                    borderRadius: '18px',
                                    border: '1px solid hsl(var(--primary) / 0.1)',
                                    display: 'flex',
                                    gap: '1.25rem',
                                    alignItems: 'center'
                                }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '14px',
                                        backgroundColor: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'hsl(var(--primary))',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                    }}>
                                        <Info size={28} />
                                    </div>
                                    <p style={{ fontSize: '0.85rem', fontWeight: '600', margin: 0, opacity: 0.7, lineHeight: '1.5' }}>
                                        Confirmar este ingreso actualizará automáticamente el stock en la sucursal asignada y promediará los costos de inventario.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'flex-end' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '0.9rem', fontWeight: '800', opacity: 0.4, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total de Ingreso</p>
                                        <span style={{ fontSize: '2.5rem', fontWeight: '950', color: 'hsl(var(--foreground))', letterSpacing: '-0.03em' }}>
                                            <span style={{ fontSize: '1.5rem', fontWeight: '800', opacity: 0.3, marginRight: '4px' }}>{currencySymbol}</span>
                                            {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    {!readOnly && (
                                        <button
                                            type="submit"
                                            className="btn btn-primary shadow-2xl"
                                            disabled={isSaving}
                                            style={{
                                                padding: '1.25rem 2.5rem',
                                                borderRadius: '16px',
                                                gap: '1rem',
                                                fontSize: '1.1rem',
                                                fontWeight: '900',
                                                width: '100%',
                                                background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
                                                border: 'none',
                                                boxShadow: '0 8px 30px hsl(var(--primary) / 0.3)',
                                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                                letterSpacing: '0.02em'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 40px hsl(var(--primary) / 0.4)' }}
                                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 30px hsl(var(--primary) / 0.3)' }}
                                        >
                                            {isSaving ? (
                                                <><Loader2 size={24} className="animate-spin" /> PROCESANDO... </>
                                            ) : (
                                                <><Save size={24} /> {initialData ? 'GUARDAR CAMBIOS' : 'PROCESAR INGRESO'}</>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    )
}
