import React, { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, Building2, User, Package, Calculator, Info, ChevronRight, Box, Printer, ClipboardList, Tag } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function SaleModal({ onClose, onSave, isSaving, initialData, currencySymbol = 'Bs.' }) {
    const [customers, setCustomers] = useState([])
    const [branches, setBranches] = useState([])
    const [products, setProducts] = useState([])
    const [selectedCustomer, setSelectedCustomer] = useState(initialData?.customer_id || '')
    const [selectedBranch, setSelectedBranch] = useState(initialData?.branch_id || '')
    const [items, setItems] = useState(initialData?.items || [])
    const [discount, setDiscount] = useState(initialData?.discount || 0)
    const [tax, setTax] = useState(initialData?.tax || 0)
    const [error, setError] = useState(null)

    useEffect(() => {
        async function fetchInitialData() {
            const [customersRes, branchesRes, productsRes] = await Promise.all([
                supabase.from('customers').select('*').eq('active', true).order('name'),
                supabase.from('branches').select('*').eq('active', true).order('name'),
                supabase.from('products').select('*').order('name')
            ])
            setCustomers(customersRes.data || [])
            setBranches(branchesRes.data || [])
            setProducts(productsRes.data || [])

            if (!initialData && branchesRes.data?.length > 0) {
                setSelectedBranch(branchesRes.data[0].id)
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
                quantity: 1,
                price: product.price || 0,
                total: product.price || 0
            }]
        })
        setShowProductSearch(false)
        setSearchTerm('')
    }
    const [searchTerm, setSearchTerm] = useState('')
    const [showProductSearch, setShowProductSearch] = useState(false)

    const removeItem = (productId) => setItems(prev => prev.filter(i => i.product_id !== productId))

    const updateItem = (productId, field, value) => {
        setItems(prev => prev.map(item => {
            if (item.product_id === productId) {
                const updated = { ...item }
                updated[field] = parseFloat(value) || 0
                updated.total = updated.quantity * updated.price
                return updated
            }
            return item
        }))
    }

    const subtotal = items.reduce((acc, item) => acc + item.total, 0)
    const total = Math.max(0, subtotal + parseFloat(tax || 0) - parseFloat(discount || 0))

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!selectedBranch) return setError('Seleccione una sucursal')
        if (items.length === 0) return setError('Agregue al menos un producto')
        onSave({
            customer_id: selectedCustomer || null,
            branch_id: selectedBranch,
            subtotal,
            tax: parseFloat(tax || 0),
            discount: parseFloat(discount || 0),
            total,
            items
        })
    }

    const filteredProducts = products.filter(p =>
        (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (p.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem'
        }}>
            <div className="card shadow-2xl" style={{
                width: '100%',
                maxWidth: '1100px',
                padding: 0,
                borderRadius: '30px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                backgroundColor: 'hsl(var(--background))'
            }}>
                {/* Header Section */}
                <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '15px' }}>
                            <ClipboardList size={28} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.6rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em' }}>{initialData ? 'Detalle de Venta' : 'Nueva Operación'}</h2>
                            <p style={{ fontSize: '0.85rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Gestión de historial y edición de transacciones</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }} disabled={isSaving}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, overflow: 'hidden' }}>
                        {/* Sidebar: Header Info */}
                        <div style={{ padding: '2.5rem', borderRight: '1px solid hsl(var(--border) / 0.4)', backgroundColor: 'hsl(var(--secondary) / 0.05)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.75rem' }}>
                                    <User size={14} /> Cliente
                                </label>
                                <select
                                    style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    value={selectedCustomer}
                                    onChange={(e) => setSelectedCustomer(e.target.value)}
                                >
                                    <option value="">Cliente General</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.75rem' }}>
                                    <Building2 size={14} /> Sucursal de Origen
                                </label>
                                <select
                                    style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    required
                                >
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.75rem' }}>
                                    <Tag size={14} /> Descuento Aplicado
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3 }}>{currencySymbol}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={discount}
                                        onChange={(e) => setDiscount(e.target.value)}
                                        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.2rem', backgroundColor: 'white', borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', padding: '1.5rem', backgroundColor: 'hsl(var(--primary) / 0.05)', borderRadius: '20px', border: '1px solid hsl(var(--primary) / 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'hsl(var(--primary))', marginBottom: '1rem' }}>
                                    <Calculator size={20} />
                                    <span style={{ fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase' }}>Resumen</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.6 }}>
                                    <span>Subtotal</span>
                                    <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.6 }}>
                                    <span>Impuestos (+)</span>
                                    <input
                                        type="number"
                                        value={tax}
                                        onChange={(e) => setTax(e.target.value)}
                                        style={{ width: '80px', border: 'none', background: 'transparent', textAlign: 'right', fontWeight: '700', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'hsl(var(--destructive))', opacity: 0.8 }}>
                                    <span>Descuento (-)</span>
                                    <span>-{currencySymbol}{parseFloat(discount || 0).toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid hsl(var(--border) / 0.2)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                                    <span style={{ fontWeight: '800' }}>TOTAL</span>
                                    <span style={{ fontWeight: '900', fontSize: '1.5rem', color: 'hsl(var(--primary))' }}>{currencySymbol}{total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Main Content: Items List */}
                        <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Package size={20} /> Detalle de Ítems
                                </h3>
                                <div style={{ position: 'relative' }}>
                                    <button
                                        type="button"
                                        className="btn btn-primary shadow-lg shadow-primary/20"
                                        onClick={() => setShowProductSearch(!showProductSearch)}
                                        style={{ gap: '0.5rem', borderRadius: '12px', padding: '0.6rem 1.25rem' }}
                                    >
                                        <Plus size={18} /> AGREGAR PRODUCTO
                                    </button>

                                    {showProductSearch && (
                                        <div className="card shadow-2xl" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '0.75rem', width: '350px', zIndex: 110, padding: 0, overflow: 'hidden', borderRadius: '18px' }}>
                                            <div style={{ padding: '0.75rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Buscar por nombre o SKU..."
                                                        style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.2rem', backgroundColor: 'white', borderRadius: '10px', border: '1px solid hsl(var(--primary) / 0.2)', fontSize: '0.85rem', outline: 'none' }}
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                                {filteredProducts.map(p => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        className="btn"
                                                        style={{ width: '100%', justifyContent: 'flex-start', padding: '0.75rem 1rem', borderRadius: 0, border: 'none', borderBottom: '1px solid hsl(var(--border) / 0.2)', backgroundColor: 'transparent' }}
                                                        onClick={() => addItem(p)}
                                                    >
                                                        <div style={{ textAlign: 'left' }}>
                                                            <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{p.name}</div>
                                                            <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>SKU: {p.sku} • {currencySymbol}{p.price.toFixed(2)}</div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid hsl(var(--border) / 0.5)', borderRadius: '20px', backgroundColor: 'white' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.2)', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr>
                                            <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Producto</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '110px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Cant.</th>
                                            <th style={{ padding: '1rem', textAlign: 'center', width: '130px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Precio Lta.</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '130px', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Subtotal</th>
                                            <th style={{ padding: '1rem', textAlign: 'right', width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '4rem', textAlign: 'center' }}>
                                                    <Box size={48} style={{ margin: '0 auto 1rem', opacity: 0.1 }} />
                                                    <p style={{ fontWeight: '700', opacity: 0.3 }}>Sin ítems en esta venta</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map(item => (
                                                <tr key={item.product_id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ fontWeight: '800', fontSize: '0.9rem' }}>{item.name}</div>
                                                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>SKU: {item.sku}</div>
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(item.product_id, 'quantity', e.target.value)}
                                                            style={{ width: '100%', padding: '0.5rem', textAlign: 'center', backgroundColor: 'hsl(var(--secondary) / 0.3)', border: 'none', borderRadius: '8px', fontWeight: '800', outline: 'none' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ position: 'relative' }}>
                                                            <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', fontWeight: '900', opacity: 0.3 }}>{currencySymbol}</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={item.price}
                                                                onChange={(e) => updateItem(item.product_id, 'price', e.target.value)}
                                                                style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 1.5rem', textAlign: 'center', backgroundColor: 'hsl(var(--secondary) / 0.3)', border: 'none', borderRadius: '8px', fontWeight: '800', outline: 'none' }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '900', color: 'hsl(var(--foreground))' }}>
                                                        {currencySymbol}{item.total.toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(item.product_id)}
                                                            style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)', border: 'none', color: 'hsl(var(--destructive))', padding: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Footer Section */}
                    <div style={{ padding: '1.5rem 2.5rem', borderTop: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                        {initialData && (
                            <button
                                type="button"
                                onClick={() => window.dispatchEvent(new CustomEvent('print-ticket', { detail: initialData }))}
                                className="btn"
                                style={{ padding: '0.85rem 1.5rem', borderRadius: '14px', backgroundColor: 'white', fontWeight: '800', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', gap: '0.5rem' }}
                            >
                                <Printer size={20} /> IMPRIMIR TICKET
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="btn" style={{ padding: '0.85rem 2rem', borderRadius: '14px', backgroundColor: 'white', fontWeight: '800' }}>CANCELAR</button>
                        <button
                            type="submit"
                            className="btn btn-primary shadow-xl shadow-primary/20"
                            disabled={isSaving}
                            style={{ gap: '0.75rem', padding: '0.85rem 2.5rem', borderRadius: '14px', fontWeight: '800' }}
                        >
                            {isSaving ? <><Loader2 size={22} className="animate-spin" /> PROCESANDO... </> : <><Save size={22} /> {initialData ? 'GUARDAR CAMBIOS' : 'REGISTRAR OPERACIÓN'}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
