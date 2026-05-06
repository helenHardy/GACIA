import React, { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2, Search, Loader2, AlertCircle, Building2, User, Package, Calculator, Info, ChevronRight, Box, Printer, ClipboardList, Tag } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function SaleModal({ onClose, onSave, isSaving, initialData, currencySymbol = 'Bs.', readOnly = false }) {
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
                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ padding: '0.4rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '10px' }}>
                            <ClipboardList size={18} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em' }}>{initialData ? 'Detalle de Venta' : 'Nueva Operación'}</h2>
                            <p style={{ fontSize: '0.7rem', fontWeight: '500', opacity: 0.5, margin: 0 }}>Historial de transacciones</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.3rem', borderRadius: '50%' }} disabled={isSaving}>
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', flex: 1, overflow: 'hidden' }}>
                        {/* Sidebar: Header Info */}
                        <div className="no-scrollbar" style={{ padding: '0.75rem', borderRight: '1px solid hsl(var(--border) / 0.4)', backgroundColor: 'hsl(var(--secondary) / 0.05)', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem' }}>
                                    <User size={10} /> Cliente
                                </label>
                                <select
                                    disabled={readOnly}
                                    style={{ width: '100%', padding: '0.5rem', backgroundColor: readOnly ? 'hsl(var(--secondary) / 0.1)' : 'white', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.8rem', outline: 'none' }}
                                    value={selectedCustomer}
                                    onChange={(e) => setSelectedCustomer(e.target.value)}
                                >
                                    <option value="">Cliente General</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.3rem' }}>
                                    <Building2 size={10} /> Sucursal
                                </label>
                                <select
                                    disabled={readOnly}
                                    style={{ width: '100%', padding: '0.5rem', backgroundColor: readOnly ? 'hsl(var(--secondary) / 0.1)' : 'white', borderRadius: '8px', border: '1px solid hsl(var(--border) / 0.6)', fontWeight: '700', fontSize: '0.8rem', outline: 'none' }}
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    required
                                >
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div style={{ marginTop: 'auto', padding: '0.75rem', backgroundColor: 'hsl(var(--primary) / 0.05)', borderRadius: '12px', border: '1px solid hsl(var(--primary) / 0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.75rem', opacity: 0.6 }}>
                                    <span>Subtotal</span>
                                    <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid hsl(var(--border) / 0.2)', paddingTop: '0.4rem', marginTop: '0.3rem' }}>
                                    <span style={{ fontWeight: '800', fontSize: '0.75rem' }}>TOTAL</span>
                                    <span style={{ fontWeight: '900', fontSize: '1.1rem', color: 'hsl(var(--primary))' }}>{currencySymbol}{total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Main Content: Items List */}
                        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Package size={16} /> Ítems Vendidos
                                </h3>
                                {!readOnly && (
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => setShowProductSearch(!showProductSearch)}
                                        style={{ gap: '0.3rem', borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                                    >
                                        <Plus size={14} /> AGREGAR
                                    </button>
                                )}
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid hsl(var(--border) / 0.4)', borderRadius: '12px', backgroundColor: 'white' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.1)', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontSize: '0.6rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Producto</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'center', width: '60px', fontSize: '0.6rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Cant.</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'center', width: '80px', fontSize: '0.6rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>P. Unit</th>
                                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right', width: '90px', fontSize: '0.6rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Total</th>
                                            {!readOnly && <th style={{ padding: '0.4rem 0.75rem', width: '35px' }}></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '2rem', textAlign: 'center' }}>
                                                    <p style={{ fontWeight: '700', fontSize: '0.75rem', opacity: 0.3 }}>Sin productos</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map(item => (
                                                <tr key={item.product_id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.15)' }}>
                                                    <td style={{ padding: '0.35rem 0.75rem' }}>
                                                        <div style={{ fontWeight: '800', fontSize: '0.8rem' }}>{item.name}</div>
                                                        <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>SKU: {item.sku}</div>
                                                    </td>
                                                    <td style={{ padding: '0.35rem 0.75rem' }}>
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            disabled={readOnly}
                                                            onChange={(e) => updateItem(item.product_id, 'quantity', e.target.value)}
                                                            style={{ width: '100%', padding: '0.25rem', textAlign: 'center', backgroundColor: 'hsl(var(--secondary) / 0.1)', border: 'none', borderRadius: '4px', fontWeight: '700', fontSize: '0.8rem', outline: 'none' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.35rem 0.75rem' }}>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.price}
                                                            disabled={readOnly}
                                                            onChange={(e) => updateItem(item.product_id, 'price', e.target.value)}
                                                            style={{ width: '100%', padding: '0.25rem', textAlign: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: '4px', fontWeight: '700', fontSize: '0.8rem', outline: 'none' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '0.35rem 0.75rem', textAlign: 'right', fontWeight: '800', fontSize: '0.8rem' }}>
                                                        {currencySymbol}{item.total.toFixed(2)}
                                                    </td>
                                                    {!readOnly && (
                                                        <td style={{ padding: '0.35rem 0.75rem', textAlign: 'right' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(item.product_id)}
                                                                style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)', border: 'none', color: 'hsl(var(--destructive))', padding: '0.2rem', borderRadius: '4px', cursor: 'pointer' }}
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </td>
                                                    )}
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
                        {!readOnly && (
                            <button
                                type="submit"
                                className="btn btn-primary shadow-xl shadow-primary/20"
                                disabled={isSaving}
                                style={{ gap: '0.75rem', padding: '0.85rem 2.5rem', borderRadius: '14px', fontWeight: '800' }}
                            >
                                {isSaving ? <><Loader2 size={22} className="animate-spin" /> PROCESANDO... </> : <><Save size={22} /> {initialData ? 'GUARDAR CAMBIOS' : 'REGISTRAR OPERACIÓN'}</>}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}
