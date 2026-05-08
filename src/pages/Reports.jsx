import React, { useState, useEffect } from 'react'
import { 
    FileText, 
    Calendar, 
    Filter, 
    Download, 
    RefreshCw, 
    Building2, 
    ShoppingBag, 
    Search,
    Clock,
    User,
    ChevronRight,
    Package,
    Tag,
    Layers,
    ArrowRight,
    Eye,
    X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { utils, writeFile } from 'xlsx'
import { useBranch } from '../context/BranchContext'

export default function Reports() {
    const [activeTab, setActiveTab] = useState('products') // 'products', 'invoices'
    const [loading, setLoading] = useState(false)
    const { branches, selectedBranchId, setSelectedBranchId } = useBranch()
    
    // Data states
    const [soldProducts, setSoldProducts] = useState([])
    const [invoices, setInvoices] = useState([])
    const [selectedInvoice, setSelectedInvoice] = useState(null)
    
    // Filters
    const [period, setPeriod] = useState('day') // 'day', 'month', 'year', 'range'
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [searchTerm, setSearchTerm] = useState('')
    const [filterOnlyPending, setFilterOnlyPending] = useState(false)
    const [sellers, setSellers] = useState([])
    const [selectedSellerId, setSelectedSellerId] = useState('all')

    useEffect(() => {
        fetchSellers()
    }, [])

    useEffect(() => {
        fetchData()
    }, [activeTab, period, startDate, endDate, selectedBranchId, selectedSellerId])

    async function fetchSellers() {
        const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
        setSellers(data || [])
    }

    async function fetchData() {
        if (activeTab === 'products') {
            fetchSoldProducts()
        } else {
            fetchInvoices()
        }
    }

    async function fetchSoldProducts() {
        try {
            setLoading(true)
            let query = supabase
                .from('sale_items')
                .select(`
                    *,
                    product:product_id (
                        name, 
                        sku, 
                        brand:brands(name), 
                        model:models(name)
                    ),
                    sale:sale_id!inner (
                        created_at, 
                        sale_number, 
                        branch_id
                    )
                `)

            // Date filtering
            if (period === 'day') {
                const start = new Date(startDate + 'T00:00:00')
                const end = new Date(startDate + 'T23:59:59')
                query = query.gte('sale.created_at', start.toISOString()).lte('sale.created_at', end.toISOString())
            } else if (period === 'range') {
                const start = new Date(startDate + 'T00:00:00')
                const end = new Date(endDate + 'T23:59:59')
                query = query.gte('sale.created_at', start.toISOString()).lte('sale.created_at', end.toISOString())
            }

            if (selectedBranchId && selectedBranchId !== 'all') {
                query = query.eq('sale.branch_id', selectedBranchId)
            }

            if (selectedSellerId && selectedSellerId !== 'all') {
                query = query.eq('sale.user_id', selectedSellerId)
            }

            const { data, error } = await query
            if (error) throw error

            // Group and format
            setSoldProducts(data || [])
        } catch (err) {
            console.error('Error fetching sold products:', err)
        } finally {
            setLoading(false)
        }
    }

    async function fetchInvoices() {
        try {
            setLoading(true)
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    customers(id, name, current_balance),
                    seller:profiles!fk_sales_user(full_name),
                    items:sale_items(
                        *,
                        product:product_id(name, sku, description, brand:brands(name), model:models(name))
                    ),
                    customer_payments (*)
                `)
                .order('created_at', { ascending: false })

            // Date filtering
            if (period === 'day') {
                const start = new Date(startDate + 'T00:00:00')
                const end = new Date(startDate + 'T23:59:59')
                query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
            } else if (period === 'range') {
                const start = new Date(startDate + 'T00:00:00')
                const end = new Date(endDate + 'T23:59:59')
                query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
            }

            if (selectedBranchId && selectedBranchId !== 'all') {
                query = query.eq('branch_id', selectedBranchId)
            }

            if (selectedSellerId && selectedSellerId !== 'all') {
                query = query.eq('user_id', selectedSellerId)
            }

            const { data, error } = await query
            if (error) throw error

            setInvoices(data || [])
            if (data?.length > 0) {
                // Keep current selection if it still exists
                const stillExists = selectedInvoice ? data.find(inv => inv.id === selectedInvoice.id) : null
                setSelectedInvoice(stillExists || data[0])
            } else {
                setSelectedInvoice(null)
            }
        } catch (err) {
            console.error('Error fetching invoices:', err)
        } finally {
            setLoading(false)
        }
    }

    const exportToExcel = () => {
        let reportData = []
        let filename = ''

        if (activeTab === 'products') {
            reportData = soldProducts.map((item, index) => ({
                'Nro': index + 1,
                'SKU': item.product?.sku || 'N/A',
                'Marca': item.product?.brand?.name || 'N/A',
                'Modelo': item.product?.model?.name || 'N/A',
                'Cantidad': item.quantity,
                'Precio Unitario': item.price,
                'Total': item.total,
                'Fecha': new Date(item.sale?.created_at).toLocaleString()
            }))
            filename = 'Reporte_Productos_Vendidos'
        } else {
            reportData = invoices.map(inv => ({
                'Fecha': new Date(inv.created_at).toLocaleString(),
                'Nro Factura': inv.sale_number,
                'Cliente': inv.customers?.name || 'Venta General',
                'Vendedor': inv.seller?.full_name || 'Sistema',
                'Total': inv.total,
                'Descripción': inv.description || ''
            }))
            filename = 'Reporte_Facturas'
        }

        const ws = utils.json_to_sheet(reportData)
        const wb = utils.book_new()
        utils.book_append_sheet(wb, ws, "Reporte")
        writeFile(wb, `${filename}_${startDate}.xlsx`)
    }

    // Payment registration logic
    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('Efectivo')
    const [isSaving, setIsSaving] = useState(false)

    const handleRegisterPayment = async () => {
        if (!selectedInvoice || !paymentAmount || parseFloat(paymentAmount) <= 0) return
        
        try {
            setIsSaving(true)
            const { error } = await supabase.from('customer_payments').insert([{
                sale_id: selectedInvoice.id,
                customer_id: selectedInvoice.customer_id,
                amount: parseFloat(paymentAmount),
                payment_method: paymentMethod,
                notes: `Abono desde Reportes - Ticket #${selectedInvoice.sale_number}`
            }])

            if (error) throw error

            setPaymentModalOpen(false)
            setPaymentAmount('')
            fetchInvoices() // Refresh to see updated payments
        } catch (err) {
            console.error('Error registering payment:', err)
            alert('Error al registrar pago')
        } finally {
            setIsSaving(false)
        }
    }

    const totalInvoicesSum = invoices.reduce((acc, inv) => acc + Number(inv.total), 0)
    const totalSold = soldProducts.reduce((acc, item) => acc + Number(item.total), 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
            {/* Header and Main Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-0.04em', margin: 0, color: 'hsl(var(--foreground))' }}>
                        Reportes
                    </h1>
                    <p style={{ opacity: 0.5, fontWeight: '500' }}>Consulta y exporta el rendimiento de tus ventas</p>
                    
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '0.4rem', borderRadius: '16px', width: 'fit-content' }}>
                        <button
                            onClick={() => setActiveTab('products')}
                            style={{
                                padding: '0.6rem 1.5rem',
                                borderRadius: '12px',
                                border: 'none',
                                fontSize: '0.9rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'products' ? 'white' : 'transparent',
                                color: activeTab === 'products' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.5)',
                                boxShadow: activeTab === 'products' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Reporte de Ventas
                        </button>
                        <button
                            onClick={() => setActiveTab('invoices')}
                            style={{
                                padding: '0.6rem 1.5rem',
                                borderRadius: '12px',
                                border: 'none',
                                fontSize: '0.9rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'invoices' ? 'white' : 'transparent',
                                color: activeTab === 'invoices' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.5)',
                                boxShadow: activeTab === 'invoices' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Reporte de Factura
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={exportToExcel} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', fontWeight: '800' }}>
                        <Download size={20} /> EXPORTAR EXCEL
                    </button>
                    <button onClick={fetchData} className="btn" style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '0.4rem', borderRadius: '16px', gap: '0.4rem' }}>
                    {['day', 'range'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '12px',
                                border: 'none',
                                backgroundColor: period === p ? 'white' : 'transparent',
                                color: period === p ? 'hsl(var(--primary))' : '#64748b',
                                fontSize: '0.85rem',
                                fontWeight: '900',
                                cursor: 'pointer',
                                boxShadow: period === p ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                                textTransform: 'uppercase'
                            }}
                        >
                            {p === 'day' ? 'Diario' : 'Rango'}
                        </button>
                    ))}
                </div>

                <div style={{ position: 'relative', minWidth: '220px' }}>
                    <Calendar size={16} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, color: 'hsl(var(--primary))' }} />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3.2rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700', outline: 'none', backgroundColor: 'white', color: '#1e293b' }}
                    />
                </div>

                {period === 'range' && (
                    <div style={{ position: 'relative', minWidth: '220px' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, color: 'hsl(var(--primary))' }} />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3.2rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700', outline: 'none', backgroundColor: 'white', color: '#1e293b' }}
                        />
                    </div>
                )}

                <div style={{ position: 'relative', minWidth: '200px' }}>
                    <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, color: 'hsl(var(--primary))' }} />
                    <select
                        value={selectedSellerId}
                        onChange={(e) => setSelectedSellerId(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700', outline: 'none', backgroundColor: 'white', color: '#1e293b', appearance: 'none', cursor: 'pointer' }}
                    >
                        <option value="all">TODOS LOS VENDEDORES</option>
                        {sellers.map(s => (
                            <option key={s.id} value={s.id}>{s.full_name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
                
                <div style={{ marginLeft: 'auto' }}>
                    {activeTab === 'invoices' && (
                        <button 
                            onClick={() => setFilterOnlyPending(!filterOnlyPending)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '16px',
                                border: '1.5px solid',
                                borderColor: filterOnlyPending ? 'hsl(var(--destructive))' : '#e2e8f0',
                                backgroundColor: filterOnlyPending ? 'hsl(var(--destructive) / 0.1)' : 'white',
                                color: filterOnlyPending ? 'hsl(var(--destructive))' : '#475569',
                                fontSize: '0.85rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
                            }}
                        >
                            <Filter size={16} />
                            {filterOnlyPending ? 'MOSTRANDO SOLO DEUDAS' : 'FILTRAR POR DEUDAS'}
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'products' ? (
                /* TAB 1: PRODUCTOS VENDIDOS */
                <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.5)' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                                <tr>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Nro</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>SKU</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Marca</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Modelo</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, textAlign: 'center' }}>Cantidad</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, textAlign: 'right' }}>P. Unitario</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, textAlign: 'right' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Cargando datos...</td></tr>
                                ) : soldProducts.length === 0 ? (
                                    <tr><td colSpan="7" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>No hay ventas registradas</td></tr>
                                ) : (
                                    soldProducts.map((item, index) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                            <td style={{ padding: '1rem', fontWeight: '600', opacity: 0.4 }}>{index + 1}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '2px 8px', borderRadius: '6px' }}>{item.product?.sku || 'N/A'}</span>
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: '700' }}>{item.product?.brand?.name || 'N/A'}</td>
                                            <td style={{ padding: '1rem', fontWeight: '600' }}>{item.product?.model?.name || 'N/A'}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '800' }}>{item.quantity}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>Bs. {Number(item.price).toFixed(2)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '900', color: 'hsl(var(--primary))' }}>Bs. {Number(item.total).toFixed(2)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot style={{ backgroundColor: 'hsl(var(--primary))', color: 'white' }}>
                                <tr>
                                    <td colSpan="6" style={{ padding: '1.25rem 2rem', textAlign: 'right', fontWeight: '800', fontSize: '1.1rem' }}>TOTAL GENERAL</td>
                                    <td style={{ padding: '1.25rem 2rem', textAlign: 'right', fontWeight: '900', fontSize: '1.4rem' }}>Bs. {totalSold.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : (
                /* TAB 2: REPORTE DE FACTURA (Dual View) */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
                    {/* Invoice List (Left) */}
                    <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', backgroundColor: 'white', border: '1px solid hsl(var(--border) / 0.5)', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #eee', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', opacity: 0.5, textTransform: 'uppercase' }}>Facturas Emitidas</h3>
                            <div style={{ backgroundColor: 'hsl(var(--primary))', color: 'white', padding: '4px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '900' }}>
                                TOTAL: Bs. {totalInvoicesSum.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            {loading ? (
                                <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Cargando...</div>
                            ) : invoices.length === 0 ? (
                                <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>No hay facturas</div>
                            ) : (
                                invoices
                                .filter(inv => {
                                    if (!filterOnlyPending) return true
                                    if (!inv.is_credit) return false
                                    const totalPaid = inv.customer_payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0
                                    return (Number(inv.total) - totalPaid) > 0.01
                                })
                                .map(inv => {
                                    const totalPaid = inv.customer_payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0
                                    const balance = Number(inv.total) - totalPaid
                                    const isFullyPaid = !inv.is_credit || balance <= 0.01

                                    return (
                                        <div
                                            key={inv.id}
                                            onClick={() => setSelectedInvoice(inv)}
                                            style={{
                                                padding: '0.75rem 1.25rem',
                                                borderBottom: '1px solid #f1f1f1',
                                                cursor: 'pointer',
                                                display: 'grid',
                                                gridTemplateColumns: '1.2fr 1.8fr 1.2fr 0.8fr',
                                                alignItems: 'center',
                                                backgroundColor: selectedInvoice?.id === inv.id ? 'hsl(var(--primary) / 0.05)' : 'white',
                                                borderLeft: selectedInvoice?.id === inv.id ? '4px solid hsl(var(--primary))' : '4px solid transparent',
                                                transition: '0.2s',
                                                position: 'relative'
                                            }}
                                        >
                                            <div style={{ opacity: 0.6 }}>
                                                <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '800' }}>{new Date(inv.created_at).toLocaleDateString()}</p>
                                                <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '700' }}>{new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>

                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '800', color: 'hsl(var(--primary))' }}>Nro: {inv.sale_number}</p>
                                                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>{inv.customers?.name || 'Venta General'}</p>
                                                <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5 }}>{inv.seller?.full_name || 'Vendedor'}</p>
                                            </div>

                                            <div style={{ textAlign: 'right', paddingRight: '0.5rem' }}>
                                                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900' }}>{Number(inv.total).toFixed(2)}</p>
                                                <div style={{ 
                                                    fontSize: '0.6rem', 
                                                    fontWeight: '900', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px',
                                                    display: 'inline-block',
                                                    backgroundColor: isFullyPaid ? '#ecfdf5' : '#fff1f2',
                                                    color: isFullyPaid ? '#10b981' : '#e11d48',
                                                    border: '1px solid',
                                                    borderColor: isFullyPaid ? '#d1fae5' : '#ffe4e6',
                                                    marginTop: '2px'
                                                }}>
                                                    {isFullyPaid ? 'PAGADO' : `DEBE: ${balance.toFixed(2)}`}
                                                </div>
                                            </div>

                                            <div style={{ textAlign: 'right' }}>
                                                <button className="btn" style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', gap: '0.3rem', backgroundColor: 'white', border: '1px solid #eee' }}>
                                                    <Eye size={14} /> Ver
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Invoice Detail (Right) */}
                    <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', backgroundColor: 'white', border: '1px solid hsl(var(--border) / 0.5)', overflow: 'hidden', position: 'sticky', top: '1.5rem' }}>
                        {selectedInvoice ? (
                            <>
                                <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'hsl(var(--primary))' }}>Detalle de Factura #{selectedInvoice.sale_number}</h4>
                                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', opacity: 0.5 }}>Cliente: {selectedInvoice.customers?.name || 'Venta General'}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900' }}>Bs. {Number(selectedInvoice.total).toFixed(2)}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: selectedInvoice.is_credit ? 'hsl(var(--destructive))' : '#10b981' }}>
                                                    {selectedInvoice.is_credit ? 'Venta a Crédito' : `Pagado via ${selectedInvoice.payment_method}`}
                                                </span>
                                                {selectedInvoice.is_credit && (
                                                    <button 
                                                        onClick={() => setPaymentModalOpen(true)}
                                                        style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'hsl(var(--primary))', color: 'white', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}
                                                    >
                                                        REGISTRAR PAGO
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '0.5rem' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ backgroundColor: '#fff', borderBottom: '2px solid #f1f1f1' }}>
                                            <tr>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '800', opacity: 0.4 }}>CÓDIGO</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '800', opacity: 0.4 }}>NOMBRE</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '800', opacity: 0.4 }}>CANT.</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: '800', opacity: 0.4 }}>PRECIO</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoice.items?.map(item => (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: '700' }}>{item.product?.sku || 'N/A'}</td>
                                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: '700' }}>{item.product?.name}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: '800' }}>{item.quantity}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '700' }}>{Number(item.price).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {selectedInvoice.customer_payments?.length > 0 && (
                                    <div style={{ padding: '1.5rem', backgroundColor: '#f0f9ff', borderTop: '1px solid #e0f2fe' }}>
                                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', fontWeight: '900', color: 'hsl(var(--primary))', textTransform: 'uppercase' }}>Historial de Pagos / Abonos:</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {selectedInvoice.customer_payments.map(p => (
                                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e0f2fe' }}>
                                                    <div>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: '800' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                                                        <span style={{ fontSize: '0.75rem', opacity: 0.5, marginLeft: '0.5rem' }}>via {p.payment_method}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: '900', color: '#10b981' }}>+ Bs. {Number(p.amount).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            <div style={{ textAlign: 'right', marginTop: '0.5rem', borderTop: '1px dashed #bae6fd', paddingTop: '0.5rem' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>
                                                    Total Pagado: Bs. {selectedInvoice.customer_payments.reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {selectedInvoice.description && (
                                    <div style={{ padding: '1.5rem', backgroundColor: '#fff9e6', borderTop: '1px solid #ffeeba' }}>
                                        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '800', opacity: 0.5, textTransform: 'uppercase' }}>Nota / Descripción:</p>
                                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', fontWeight: '600' }}>{selectedInvoice.description}</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                                <FileText size={80} />
                                <p style={{ fontWeight: '800', marginTop: '1rem' }}>Selecciona una factura para ver el detalle</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {paymentModalOpen && selectedInvoice && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: '400px', padding: '2rem', borderRadius: '24px', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontWeight: '900' }}>Registrar Pago</h3>
                            <button onClick={() => setPaymentModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.3 }}><X /></button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '0.5rem', opacity: 0.5 }}>MONTO A ABONAR (Bs.)</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    autoFocus
                                    style={{ width: '100%', padding: '1rem', fontSize: '1.5rem', fontWeight: '900', borderRadius: '12px', border: '1.5px solid #eee', outline: 'none' }}
                                    placeholder="0.00"
                                />
                                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', fontWeight: '700', opacity: 0.4 }}>
                                    Total Factura: Bs. {Number(selectedInvoice.total).toFixed(2)}
                                </p>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '0.5rem', opacity: 0.5 }}>MÉTODO DE PAGO</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    {['Efectivo', 'QR'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            style={{
                                                padding: '0.75rem',
                                                borderRadius: '10px',
                                                border: '1.5px solid',
                                                borderColor: paymentMethod === method ? 'hsl(var(--primary))' : '#eee',
                                                backgroundColor: paymentMethod === method ? 'hsl(var(--primary) / 0.05)' : 'white',
                                                color: paymentMethod === method ? 'hsl(var(--primary))' : 'inherit',
                                                fontWeight: '800',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleRegisterPayment}
                                disabled={isSaving || !paymentAmount}
                                className="btn btn-primary"
                                style={{ padding: '1rem', borderRadius: '14px', fontWeight: '900', fontSize: '1rem', marginTop: '1rem' }}
                            >
                                {isSaving ? 'GUARDANDO...' : 'CONFIRMAR ABONO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
