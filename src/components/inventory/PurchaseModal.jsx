import React, { useState, useEffect, useMemo } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, Truck, Building2, Package, ShoppingCart, Info, ChevronRight, Layers } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function PurchaseModal({ onClose, onSave, isSaving, initialData, currencySymbol = 'Bs.', readOnly = false }) {
    const [suppliers, setSuppliers] = useState([])
    const [branches, setBranches] = useState([])
    const [products, setProducts] = useState([])
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
                const [suppliersRes, branchesRes, productsRes] = await Promise.all([
                    supabase.from('suppliers').select('*').order('name'),
                    supabase.from('branches').select('*').eq('active', true).order('name'),
                    supabase.from('products').select('*, categories(name)').order('name')
                ])

                setSuppliers(suppliersRes.data || [])
                setProducts(productsRes.data || [])

                // 3. Filter branches
                let finalBranches = branchesRes.data || []
                if (assignedIds.length > 0) {
                    finalBranches = finalBranches.filter(b => assignedIds.includes(b.id))
                }
                setBranches(finalBranches)

                if (!initialData && finalBranches.length > 0) {
                    setSelectedBranch(finalBranches[0].id)
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
                category_name: product.categories?.name,
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
                } else if (field === 'units_per_pack' || field === 'quantity' || field === 'unit_cost') {
                    updated[field] = parseFloat(value) || 0
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
        if (!selectedSupplier) return setError('Seleccione un proveedor para continuar.')
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
            supplier_id: selectedSupplier,
            branch_id: selectedBranch,
            total,
            items: processedItems
        })
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    )

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
                            <ShoppingCart size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
                                {initialData ? 'Modificar Compra' : 'Registrar Compra'}
                            </h2>
                            <p style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Entrada de mercadería al inventario</p>
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

                        {/* Header Fields Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', padding: '1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.05)', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.4)' }}>
                            <div>
                                <h3 style={sectionTitleStyle}><Truck size={18} /> Proveedor</h3>
                                <div style={{ position: 'relative' }}>
                                    <Truck size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                    <select
                                        style={{ ...inputStyle, paddingLeft: '2.5rem', backgroundColor: readOnly ? 'hsl(var(--secondary) / 0.1)' : 'hsl(var(--secondary) / 0.2)' }}
                                        value={selectedSupplier}
                                        onChange={(e) => setSelectedSupplier(e.target.value)}
                                        disabled={readOnly}
                                        required
                                    >
                                        <option value="">Seleccione el proveedor encargado...</option>
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
                                            className="btn btn-primary shadow-sm"
                                            onClick={() => setShowProductSearch(!showProductSearch)}
                                            style={{ borderRadius: '10px', gap: '0.6rem', padding: '0.6rem 1.2rem', fontWeight: '700' }}
                                        >
                                            <Plus size={18} />
                                            Agregar Producto
                                        </button>
                                    )}

                                    {showProductSearch && (
                                        <div className="card shadow-2xl" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.75rem', width: '400px', zIndex: 110, padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
                                            <div style={{ padding: '0.75rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Buscar por nombre o SKU..."
                                                        className="form-input"
                                                        style={{ ...inputStyle, paddingLeft: '2.4rem', border: '1px solid hsl(var(--primary) / 0.2)' }}
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                {filteredProducts.length === 0 ? (
                                                    <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No se encontraron productos</div>
                                                ) : (
                                                    filteredProducts.map(p => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            className="btn"
                                                            style={{ width: '100%', justifyContent: 'flex-start', padding: '0.85rem 1rem', border: 'none', borderBottom: '1px solid hsl(var(--border) / 0.3)', borderRadius: 0 }}
                                                            onClick={() => addItem(p)}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                                                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'hsl(var(--primary) / 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))' }}>
                                                                    <Package size={18} />
                                                                </div>
                                                                <div style={{ textAlign: 'left', flex: 1 }}>
                                                                    <p style={{ fontWeight: '700', fontSize: '0.85rem', margin: 0 }}>{p.name}</p>
                                                                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>SKU: {p.sku || '---'} • {p.categories?.name || 'Gral.'}</span>
                                                                </div>
                                                                <ChevronRight size={14} opacity={0.3} />
                                                            </div>
                                                        </button>
                                                    ))
                                                )}
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
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '130px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Modo Ingenso</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '100px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Cant.</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '100px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Uds./Caja</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '130px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Costo {currencySymbol}</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '130px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>Subtotal</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '50px' }}></th>
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
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(item.product_id, 'quantity', e.target.value)}
                                                            disabled={readOnly}
                                                            className="form-input"
                                                            style={{ ...inputStyle, textAlign: 'center', backgroundColor: readOnly ? 'transparent' : 'white' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        {item.is_pack ? (
                                                            <input
                                                                type="number"
                                                                value={item.units_per_pack}
                                                                onChange={(e) => updateItem(item.product_id, 'units_per_pack', e.target.value)}
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
                                                                step="0.01"
                                                                value={item.unit_cost}
                                                                onChange={(e) => updateItem(item.product_id, 'unit_cost', e.target.value)}
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1.5fr) 1fr', gap: '2rem', alignItems: 'flex-end', marginTop: '1rem' }}>
                            <div style={{ padding: '1.25rem', backgroundColor: 'hsl(var(--primary) / 0.03)', borderRadius: '16px', border: '1px solid hsl(var(--primary) / 0.1)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ color: 'hsl(var(--primary))' }}><Info size={24} /></div>
                                <p style={{ fontSize: '0.8rem', fontWeight: '500', margin: 0, opacity: 0.7 }}>
                                    Al procesar este ingreso, los costos de compra se promediarán en el inventario y las unidades especificadas se sumarán al stock actual de la sucursal seleccionada.
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                    <span style={{ fontSize: '1rem', fontWeight: '700', opacity: 0.5 }}>Subtotal de Compra:</span>
                                    <span style={{ fontSize: '1.8rem', fontWeight: '900', color: 'hsl(var(--foreground))' }}>{currencySymbol}{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                {!readOnly && (
                                    <button
                                        type="submit"
                                        className="btn btn-primary shadow-xl shadow-primary/20"
                                        disabled={isSaving}
                                        style={{ padding: '1rem', borderRadius: '14px', gap: '0.75rem', fontSize: '1rem', fontWeight: '800' }}
                                    >
                                        {isSaving ? (
                                            <><Loader2 size={24} className="animate-spin" /> PROCESANDO INGRESO...</>
                                        ) : (
                                            <><Save size={24} /> {initialData ? 'GUARDAR MODIFICACIONES' : 'PROCESAR INGRESO A STOCK'}</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
