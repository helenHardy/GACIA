import React, { useState, useEffect, useMemo } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, ArrowRight, Building2, Package, MapPin, ChevronRight, Info, ArrowLeftRight, Box } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function TransferModal({ onClose, onSave, isSaving, initialData = null, readOnly = false }) {
    const [branches, setBranches] = useState([])
    const [products, setProducts] = useState([])
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
            const [branchesRes, productsRes] = await Promise.all([
                supabase.from('branches').select('*').eq('active', true).order('name'),
                supabase.from('products').select('*, categories(name)').order('name')
            ])

            // 3. Filter branches for the user (only origin and destination must be within their assigned branches OR they can send to any branch if they are admin)
            // Actually, usually a user can send FROM their branch TO any other branch, or only see their branches.
            // Let's stick to the requester's intent: "solo las sucursales que tiene permiso".
            let availableBranches = branchesRes.data || []
            if (!isUserAdmin && assignedIds.length > 0) {
                availableBranches = availableBranches.filter(b => assignedIds.includes(b.id))
            }

            setBranches(availableBranches)
            setProducts(productsRes.data || [])

            if (!initialData && availableBranches.length > 0) {
                setOriginBranch(availableBranches[0].id)
                if (availableBranches.length > 1) {
                    setDestBranch(availableBranches[1].id)
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
                category_name: product.categories?.name,
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
                updates.display_quantity = Math.max(1, parseInt(value) || 0)
            } else if (field === 'unit_type') {
                updates.unit_type = value
                if (value === 'UNIDAD') updates.units_per_box = 1
                else if (value === 'CAJA' && updates.units_per_box === 1) updates.units_per_box = 12
            } else if (field === 'units_per_box') {
                updates.units_per_box = Math.max(1, parseInt(value) || 1)
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
                                        <div className="card shadow-2xl" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.75rem', width: '400px', zIndex: 110, padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
                                            <div style={{ padding: '0.75rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Buscar por nombre o SKU..."
                                                        className="form-input"
                                                        style={{ ...inputStyle, paddingLeft: '2.4rem', border: '1px solid hsl(var(--primary) / 0.2)', backgroundColor: 'white' }}
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                {filteredProducts.length === 0 ? (
                                                    <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>No hay coincidencias</div>
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
                                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>SKU: {p.sku || '---'}</span>
                                                                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: (branchStock[p.id] || 0) > 0 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))' }}>Stock: {branchStock[p.id] || 0}</span>
                                                                    </div>
                                                                </div>
                                                                <Plus size={14} opacity={0.3} />
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
                                                            value={item.display_quantity}
                                                            onChange={(e) => updateItem(item.product_id, 'display_quantity', e.target.value)}
                                                            disabled={readOnly}
                                                            className="form-input"
                                                            style={{ ...inputStyle, textAlign: 'center', backgroundColor: readOnly ? 'transparent' : 'white' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        {item.unit_type === 'CAJA' ? (
                                                            <input
                                                                type="number"
                                                                value={item.units_per_box}
                                                                onChange={(e) => updateItem(item.product_id, 'units_per_box', e.target.value)}
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
        </div>
    )
}
