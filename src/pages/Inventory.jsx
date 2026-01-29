import React, { useState, useEffect } from 'react'
import { Plus, Search, Filter, Package, AlertTriangle, RefreshCw, Edit2, Trash2, Building2, History, Download, X, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ProductModal from '../components/inventory/ProductModal'
import KardexDrawer from '../components/inventory/KardexDrawer'

export default function Inventory() {
    const [products, setProducts] = useState([])
    const [branches, setBranches] = useState([])
    const [selectedBranchId, setSelectedBranchId] = useState('all')
    const [isAdmin, setIsAdmin] = useState(false)
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [currencySymbol, setCurrencySymbol] = useState('Bs.')

    // UI state
    const [toast, setToast] = useState(null)
    const [deleteId, setDeleteId] = useState(null)

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [viewingKardexProduct, setViewingKardexProduct] = useState(null)

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000)
            return () => clearTimeout(timer)
        }
    }, [toast])

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
    }

    useEffect(() => {
        checkUserRole()
        fetchBranches()
        fetchSettings()
    }, [])

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            setIsAdmin(data?.role === 'Administrador')
        }
    }

    async function fetchSettings() {
        const { data } = await supabase.from('settings').select('*')
        if (data) {
            const mapped = {}
            data.forEach(item => mapped[item.key] = item.value)

            if (mapped.currency === 'BOL') setCurrencySymbol('Bs.')
            else if (mapped.currency === 'EUR') setCurrencySymbol('€')
            else if (mapped.currency === 'USD') setCurrencySymbol('$')
        }
    }

    useEffect(() => {
        fetchProducts()
    }, [selectedBranchId])

    async function fetchBranches() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            const isUserAdmin = profile?.role === 'Administrador'

            let query = supabase.from('branches').select('*').eq('active', true).order('name')

            if (!isUserAdmin) {
                const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                const assignedIds = assignments?.map(a => a.branch_id) || []

                if (assignedIds.length > 0) {
                    query = query.in('id', assignedIds)
                } else {
                    setBranches([])
                    return
                }
            }

            const { data } = await query
            setBranches(data || [])

            // Set default selection logic
            if (data && data.length > 0) {
                if (selectedBranchId === 'all' && !isUserAdmin) {
                    setSelectedBranchId(data[0].id)
                } else if (!selectedBranchId || (selectedBranchId !== 'all' && !data.find(b => b.id === selectedBranchId))) {
                    setSelectedBranchId(data[0].id)
                }
            }
        } catch (err) {
            console.error('Error fetching branches:', err)
        }
    }

    const handleExport = () => {
        const headers = ['SKU', 'Nombre', 'Categoría', 'Precio', 'Stock', 'Mínimo']
        const rows = filteredProducts.map(p => [
            p.sku,
            p.name,
            p.category,
            p.current_price,
            p.current_stock,
            p.current_min_stock
        ])

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `inventario_${new Date().toLocaleDateString('sv-SE')}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    async function fetchProducts() {
        try {
            setLoading(true)
            setError(null)

            let query = supabase
                .from('products')
                .select(`
                    *,
                    category:categories(name),
                    brand:brands(name),
                    model:models(name),
                    product_branch_settings(*)
                `)

            if (selectedBranchId !== 'all') {
                // Filter by specific branch using the join table
                query = supabase
                    .from('products')
                    .select(`
                        *,
                        category:categories(name),
                        brand:brands(name),
                        model:models(name),
                        settings:product_branch_settings!inner(*)
                    `)
                    .eq('settings.branch_id', selectedBranchId)
            }

            const { data, error } = await query.order('name')

            if (error) throw error

            // Map data to handle easy access to current branch stock/price
            const mappedProducts = data.map(p => {
                if (selectedBranchId === 'all') {
                    return { ...p, current_stock: p.stock, current_price: p.price, current_min_stock: p.min_stock }
                }
                const s = p.settings ? p.settings[0] : null
                return {
                    ...p,
                    current_stock: s ? s.stock : 0,
                    current_price: (s && s.price) ? s.price : p.price,
                    current_min_stock: s ? s.min_stock : p.min_stock
                }
            })

            setProducts(mappedProducts || [])
        } catch (err) {
            console.error('Error fetching products:', err)
            setError('Error al cargar los productos.')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (formData) => {
        try {
            setIsSaving(true)
            const { branch_settings, ...productData } = formData

            let productId = editingProduct?.id

            if (editingProduct) {
                // Update product
                const { error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', editingProduct.id)
                if (error) throw error
                showToast('Producto actualizado correctamente')
            } else {
                // Create product
                const { data, error } = await supabase
                    .from('products')
                    .insert([productData])
                    .select()
                if (error) throw error
                productId = data[0].id
                showToast('Producto creado correctamente')
            }

            // Save branch settings
            if (branch_settings && branch_settings.length > 0) {
                const settingsToSave = branch_settings.map(s => ({
                    product_id: productId,
                    branch_id: s.branch_id,
                    stock: s.stock,
                    min_stock: s.min_stock,
                    price: s.price || null
                }))

                const { error: settingsError } = await supabase
                    .from('product_branch_settings')
                    .upsert(settingsToSave, { onConflict: 'product_id, branch_id' })

                if (settingsError) throw settingsError
            }

            setIsModalOpen(false)
            setEditingProduct(null)
            fetchProducts()
        } catch (err) {
            console.error('Error saving product:', err)
            showToast('Error al guardar: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    const confirmDelete = async () => {
        if (!deleteId) return
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', deleteId)
            if (error) throw error
            showToast('Producto eliminado correctamente')
            fetchProducts()
        } catch (err) {
            console.error('Error deleting product:', err)
            showToast('Error al eliminar. Verifique dependencias', 'error')
        } finally {
            setDeleteId(null)
        }
    }

    const filteredProducts = products.filter(p =>
        (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (p.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ position: 'relative', paddingBottom: '2rem' }}>
            {/* Custom Toast */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    backgroundColor: toast.type === 'error' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))',
                    color: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: 'var(--radius)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 200,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    {toast.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    <span style={{ fontWeight: '500' }}>{toast.message}</span>
                    <button onClick={() => setToast(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <X size={16} />
                    </button>
                    <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            {deleteId && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 150,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ width: '400px', maxWidth: '90vw', padding: '2rem', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', backgroundColor: 'hsl(var(--destructive) / 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <Trash2 size={32} color="hsl(var(--destructive))" />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>¿Eliminar producto?</h3>
                        <p style={{ color: 'hsl(var(--secondary-foreground))', marginBottom: '2rem' }}>
                            Esta acción no se puede deshacer. Se eliminará el producto y su configuración de sucursales.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--secondary))' }} onClick={() => setDeleteId(null)}>Cancelar</button>
                            <button className="btn" style={{ flex: 1, backgroundColor: 'hsl(var(--destructive))', color: 'white' }} onClick={confirmDelete}>Eliminar</button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <ProductModal
                    product={editingProduct}
                    isSaving={isSaving}
                    currencySymbol={currencySymbol}
                    onClose={() => {
                        setIsModalOpen(false)
                        setEditingProduct(null)
                    }}
                    onSave={handleSave}
                />
            )}

            {viewingKardexProduct && (
                <KardexDrawer
                    product={viewingKardexProduct}
                    onClose={() => setViewingKardexProduct(null)}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Inventario</h1>
                    <p style={{ color: 'hsl(var(--secondary-foreground))' }}>Gestión de productos y existencias</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn"
                        onClick={handleExport}
                        style={{ backgroundColor: 'hsl(var(--secondary))', gap: '0.5rem' }}
                        title="Exportar a CSV"
                    >
                        <Download size={20} />
                        Exportar
                    </button>
                    <button
                        className="btn"
                        onClick={fetchProducts}
                        disabled={loading}
                        style={{ backgroundColor: 'hsl(var(--secondary))' }}
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus size={20} style={{ marginRight: '0.5rem' }} />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', padding: '1rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--secondary-foreground))' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        className="btn"
                        style={{
                            width: '100%',
                            paddingLeft: '2.5rem',
                            backgroundColor: 'hsl(var(--secondary))',
                            cursor: 'text',
                            justifyContent: 'flex-start'
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Building2 size={20} style={{ color: 'hsl(var(--secondary-foreground))' }} />
                    <select
                        disabled={branches.length <= 1 && !isAdmin}
                        style={{ backgroundColor: 'hsl(var(--secondary))', border: 'none', cursor: 'pointer' }}
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                    >
                        {isAdmin && <option value="all">Ver Todas (Stock Global)</option>}
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <button className="btn" style={{ backgroundColor: 'hsl(var(--secondary))' }}>
                    <Filter size={20} style={{ marginRight: '0.5rem' }} />
                    Filtros
                </button>
            </div>

            {error && (
                <div className="card" style={{ marginBottom: '2rem', borderColor: 'hsl(var(--destructive))', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertTriangle size={20} />
                        <p>{error}</p>
                    </div>
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', minHeight: '200px' }}>
                {loading && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'hsl(var(--background) / 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                    }}>
                        <RefreshCw size={32} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                    </div>
                )}

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', opacity: loading ? 0.5 : 1 }}>
                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.5)', borderBottom: '1px solid hsl(var(--border))' }}>
                        <tr>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Imagen</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Producto</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Atributos</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Stock</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Precio</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>Estado</th>
                            <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.length === 0 && !loading ? (
                            <tr>
                                <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--secondary-foreground))' }}>
                                    <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                    <p>No se encontraron productos.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map(product => (
                                <tr
                                    key={product.id}
                                    style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)', transition: 'background-color 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{
                                            width: '56px',
                                            height: '56px',
                                            backgroundColor: 'hsl(var(--secondary) / 0.4)',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid hsl(var(--border) / 0.5)',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                        }}>
                                            {product.image_url ? (
                                                <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <Package size={24} style={{ opacity: 0.2 }} />
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <p style={{ fontWeight: '700', fontSize: '0.95rem', margin: 0, color: 'hsl(var(--foreground))' }}>{product.name || 'Sin nombre'}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--secondary-foreground))', opacity: 0.6, margin: 0 }}>SKU: {product.sku || '---'}</p>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            <span style={{ padding: '2px 10px', backgroundColor: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '600', color: 'hsl(var(--secondary-foreground))' }}>
                                                {product.category?.name || 'Gral'}
                                            </span>
                                            {product.brand?.name && (
                                                <span style={{ padding: '2px 10px', backgroundColor: 'hsl(var(--primary) / 0.08)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.15)', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700' }}>
                                                    {product.brand.name}
                                                </span>
                                            )}
                                            {product.model?.name && (
                                                <span style={{ padding: '2px 10px', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '500' }}>
                                                    {product.model.name}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: '600' }}>{product.current_stock ?? 0}</span>
                                            {(product.current_stock ?? 0) <= (product.current_min_stock ?? 0) && (
                                                <AlertTriangle size={16} color="hsl(var(--destructive))" />
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{currencySymbol}{(product.current_price ?? 0).toFixed(2)}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            backgroundColor: (product.current_stock ?? 0) > (product.current_min_stock ?? 0) ? 'hsl(142 76% 36% / 0.1)' : 'hsl(0 84% 60% / 0.1)',
                                            color: (product.current_stock ?? 0) > (product.current_min_stock ?? 0) ? 'hsl(142 76% 36%)' : 'hsl(0 84% 60%)'
                                        }}>
                                            {(product.current_stock ?? 0) > (product.current_min_stock ?? 0) ? 'En Stock' : 'Bajo Stock'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <button
                                                className="btn"
                                                style={{ padding: '0.5rem', color: 'hsl(var(--primary))' }}
                                                onClick={() => setViewingKardexProduct(product)}
                                                title="Ver historial de movimientos"
                                            >
                                                <History size={16} />
                                            </button>
                                            <button
                                                className="btn"
                                                style={{ padding: '0.5rem', color: 'hsl(var(--secondary-foreground))' }}
                                                onClick={() => {
                                                    setEditingProduct(product)
                                                    setIsModalOpen(true)
                                                }}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                className="btn"
                                                style={{ padding: '0.5rem', color: 'hsl(var(--destructive))' }}
                                                onClick={() => setDeleteId(product.id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
