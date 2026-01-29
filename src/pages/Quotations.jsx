import React, { useState, useEffect, useRef } from 'react'
import {
    Search,
    Plus,
    RefreshCw,
    FileText,
    Building2,
    Calendar,
    Eye,
    Trash2,
    Printer,
    ShoppingCart,
    MoreVertical,
    CheckCircle,
    ArrowRight,
    TrendingUp,
    Target,
    DollarSign,
    ClipboardList,
    Clock,
    User,
    X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import QuotationModal from '../components/pos/QuotationModal'

export default function Quotations() {
    const [quotations, setQuotations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingQuotation, setEditingQuotation] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [currencySymbol, setCurrencySymbol] = useState('Bs.')
    const [branches, setBranches] = useState([])
    const [filterBranchId, setFilterBranchId] = useState('all')
    const [filterMode, setFilterMode] = useState('day') // 'day', 'month', 'year'
    const [filterDay, setFilterDay] = useState('')
    const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString())
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())

    const getLocalDate = (date) => {
        if (!date) return ''
        const d = new Date(date)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    useEffect(() => {
        setFilterDay(getLocalDate(new Date()))
        fetchQuotations()
        fetchBranches()
        fetchSettings()
    }, [])

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

    async function fetchBranches() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Get branch assignments for this user
        const { data: assignments } = await supabase
            .from('user_branches')
            .select('branch_id')
            .eq('user_id', user.id)

        const assignedIds = assignments?.map(a => a.branch_id) || []

        // 2. Fetch branches and filter
        let query = supabase.from('branches').select('*').eq('active', true).order('name')

        // If user has specific assignments, filter by them
        if (assignedIds.length > 0) {
            query = query.in('id', assignedIds)
        }

        const { data } = await query
        setBranches(data || [])

        // Set default filter to all if user has access to multiple, or the only one if single
        if (data?.length === 1) {
            setFilterBranchId(data[0].id)
        }
    }

    async function fetchQuotations() {
        try {
            setLoading(true)
            setError(null)
            const { data, error } = await supabase
                .from('quotations')
                .select(`
                    *,
                    customers(name, tax_id),
                    branches(name),
                    profiles:user_id(full_name)
                `)
                .order('created_at', { ascending: false })

            if (error) throw error
            setQuotations(data || [])
        } catch (err) {
            console.error('Error fetching quotations:', err)
            setError('Error al cargar las cotizaciones.')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (formData, items) => {
        try {
            setIsSaving(true)
            const { data: { user } } = await supabase.auth.getUser()

            const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0)
            const discount = parseFloat(formData.discount || 0)
            const tax = parseFloat(formData.tax || 0)
            const total = Math.max(0, subtotal + tax - discount)

            const quotationData = {
                ...formData,
                customer_id: formData.customer_id ? parseInt(formData.customer_id) : null,
                branch_id: formData.branch_id ? parseInt(formData.branch_id) : null,
                user_id: user?.id,
                subtotal,
                discount,
                tax,
                total,
                status: editingQuotation ? editingQuotation.status : 'Pendiente'
            }

            let quotationId = editingQuotation?.id

            if (editingQuotation) {
                const { error } = await supabase.from('quotations').update(quotationData).eq('id', editingQuotation.id)
                if (error) throw error
                // Delete old items and insert new ones
                await supabase.from('quotation_items').delete().eq('quotation_id', editingQuotation.id)
            } else {
                const { data, error } = await supabase.from('quotations').insert([quotationData]).select().single()
                if (error) throw error
                quotationId = data.id
            }

            const { error: itemsError } = await supabase.from('quotation_items').insert(
                items.map(item => ({
                    quotation_id: quotationId,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity
                }))
            )
            if (itemsError) throw itemsError

            setIsModalOpen(false)
            setEditingQuotation(null)
            fetchQuotations()
        } catch (err) {
            console.error('Error saving quotation:', err)
            alert('Error al guardar la cotización: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleConvert = async (quotation) => {
        if (!confirm('¿Deseas convertir esta cotización en una venta real? Se registrará la transacción y se descontará del stock.')) return

        try {
            setLoading(true)

            // 1. Fetch items
            const { data: qItems, error: itemsFetchErr } = await supabase
                .from('quotation_items')
                .select('*')
                .eq('quotation_id', quotation.id)

            if (itemsFetchErr) throw itemsFetchErr
            if (!qItems || qItems.length === 0) throw new Error('La cotización no tiene productos.')

            // 2. Get current user
            const { data: { user } } = await supabase.auth.getUser()

            // 3. Insert into Sales
            const { data: sale, error: saleErr } = await supabase
                .from('sales')
                .insert([{
                    customer_id: quotation.customer_id,
                    branch_id: quotation.branch_id,
                    user_id: user.id,
                    subtotal: quotation.subtotal,
                    discount: quotation.discount || 0,
                    tax: quotation.tax || 0,
                    total: quotation.total,
                    payment_method: 'Efectivo',
                    amount_received: quotation.total,
                    amount_change: 0
                }])
                .select().single()

            if (saleErr) throw saleErr

            // 4. Insert into Sale Items
            const { error: saleItemsErr } = await supabase
                .from('sale_items')
                .insert(qItems.map(item => ({
                    sale_id: sale.id,
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.total
                })))

            if (saleItemsErr) throw saleItemsErr

            // 5. Update Quotation Status
            const { error: updateErr } = await supabase
                .from('quotations')
                .update({ status: 'Convertido' })
                .eq('id', quotation.id)

            if (updateErr) throw updateErr

            alert('¡Conversión exitosa! La cotización ahora es una venta.')
            fetchQuotations()
        } catch (err) {
            console.error('Error in conversion:', err)
            alert('Error al convertir: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleVoid = async (id) => {
        if (!confirm('¿Estás seguro de que deseas anular esta cotización?')) return
        try {
            const { error } = await supabase.from('quotations').update({ status: 'Anulado' }).eq('id', id)
            if (error) throw error
            fetchQuotations()
        } catch (err) {
            console.error('Error voiding quotation:', err)
            alert('Error al anular la cotización')
        }
    }

    const handlePrint = async (quotation) => {
        try {
            setLoading(true)
            // Fetch items
            const { data: qItems, error } = await supabase
                .from('quotation_items')
                .select('*, products(name, sku)')
                .eq('quotation_id', quotation.id)

            if (error) throw error

            const printWindow = window.open('', '_blank', 'width=900,height=800')
            if (!printWindow) {
                alert('Por favor, permite las ventanas emergentes para imprimir.')
                return
            }

            const styles = `
                @page { size: A4; margin: 2cm; }
                body { font-family: 'Inter', sans-serif; color: #333; line-height: 1.5; font-size: 12px; }
                .header { display: flex; justify-content: space-between; margin-bottom: 2rem; border-bottom: 2px solid #eee; padding-bottom: 1rem; }
                .company-info h1 { margin: 0; color: #111; font-size: 24px; text-transform: uppercase; letter-spacing: -0.5px; }
                .company-info p { margin: 2px 0; color: #666; }
                .invoice-details { text-align: right; }
                .invoice-details h2 { margin: 0; font-size: 18px; color: #111; }
                .invoice-details p { margin: 2px 0; color: #666; }
                .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #999; margin-bottom: 0.5rem; letter-spacing: 1px; }
                .customer-box { background: #f9fafb; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
                .customer-box h3 { margin: 0 0 0.5rem 0; font-size: 14px; color: #111; }
                .customer-box p { margin: 2px 0; color: #555; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                th { text-align: left; padding: 0.75rem 0; border-bottom: 1px solid #ddd; font-weight: 700; color: #555; font-size: 10px; text-transform: uppercase; }
                td { padding: 0.75rem 0; border-bottom: 1px solid #eee; color: #111; }
                .text-right { text-align: right; }
                .totals { display: flex; justify-content: flex-end; }
                .totals-box { width: 250px; }
                .totals-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #eee; }
                .totals-row.final { border-bottom: none; border-top: 2px solid #111; margin-top: 0.5rem; padding-top: 1rem; }
                .totals-row span:first-child { color: #666; font-weight: 600; }
                .totals-row.final span { font-size: 16px; font-weight: 900; color: #111; }
                .footer { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #eee; display: flex; justify-content: space-between; color: #888; font-size: 10px; }
                .notes { flex: 2; padding-right: 2rem; }
                .signature { flex: 1; text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; }
            `

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Cotización #${quotation.quotation_number}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap" rel="stylesheet">
                    <style>${styles}</style>
                </head>
                <body>
                    <div class="header">
                        <div class="company-info">
                            <h1>Gacia Store</h1>
                            <p>Av. Principal #123, Ciudad</p>
                            <p>Tel: (555) 123-4567 | info@gaciastore.com</p>
                        </div>
                        <div class="invoice-details">
                            <h2>COTIZACIÓN</h2>
                            <p style="font-size: 14px; font-weight: 700; color: #111;">#${quotation.quotation_number}</p>
                            <p>Fecha: ${new Date(quotation.created_at).toLocaleDateString()}</p>
                            <p>Válido hasta: ${new Date(quotation.valid_until).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div class="customer-box">
                        <div class="section-title">Cliente</div>
                        <h3>${quotation.customers?.name || 'Cliente General'}</h3>
                        <p>NIT/CI: ${quotation.customers?.tax_id || 'S/N'}</p>
                        ${quotation.customers?.email ? `<p>Email: ${quotation.customers.email}</p>` : ''}
                        ${quotation.customers?.phone ? `<p>Tel: ${quotation.customers.phone}</p>` : ''}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 50%;">Descripción</th>
                                <th class="text-right">Cantidad</th>
                                <th class="text-right">Precio Unit.</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${qItems.map(item => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 600;">${item.products?.name || 'Producto'}</div>
                                        <div style="color: #666; font-size: 10px;">sku: ${item.products?.sku || ''}</div>
                                    </td>
                                    <td class="text-right">${item.quantity}</td>
                                    <td class="text-right">${currencySymbol}${item.price.toFixed(2)}</td>
                                    <td class="text-right" style="font-weight: 700;">${currencySymbol}${item.total.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="totals">
                        <div class="totals-box">
                            <div class="totals-row">
                                <span>Subtotal</span>
                                <span>${currencySymbol}${quotation.subtotal.toFixed(2)}</span>
                            </div>
                            ${quotation.tax > 0 ? `
                                <div class="totals-row">
                                    <span>Impuestos (+)</span>
                                    <span>${currencySymbol}${quotation.tax.toFixed(2)}</span>
                                </div>
                            ` : ''}
                            ${quotation.discount > 0 ? `
                                <div class="totals-row" style="color: #ef4444;">
                                    <span>Descuento (-)</span>
                                    <span>-${currencySymbol}${quotation.discount.toFixed(2)}</span>
                                </div>
                            ` : ''}
                            <div class="totals-row final">
                                <span>TOTAL</span>
                                <span>${currencySymbol}${quotation.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <div class="notes">
                            <div class="section-title">Notas / Condiciones</div>
                            <p>${quotation.notes || 'Esta cotización es válida por 15 días. Precios sujetos a cambios sin previo aviso.'}</p>
                        </div>
                        <div class="signature">
                            Firma Autorizada
                        </div>
                    </div>

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
                </html>
            `

            printWindow.document.write(html)
            printWindow.document.close()

        } catch (err) {
            console.error('Error printing quotation:', err)
            alert('Error al imprimir cotización')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta cotización?')) return
        try {
            const { error } = await supabase.from('quotations').delete().eq('id', id)
            if (error) throw error
            fetchQuotations()
        } catch (err) {
            console.error('Error deleting quotation:', err)
            alert('Error al eliminar la cotización')
        }
    }

    const filteredQuotations = quotations.filter(q => {
        const qDate = new Date(q.created_at)
        const qLocalDate = getLocalDate(q.created_at)

        const matchesSearch = (q.customers?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (q.quotation_number?.toString() || '').includes(searchTerm) ||
            (q.id?.toString() || '').includes(searchTerm)

        const matchesBranch = filterBranchId === 'all' || String(q.branch_id || '') === String(filterBranchId)

        let matchesTime = true
        if (filterMode === 'day') {
            matchesTime = qLocalDate === filterDay
        } else if (filterMode === 'month') {
            matchesTime = (qDate.getMonth() + 1).toString() === filterMonth && qDate.getFullYear().toString() === filterYear
        } else if (filterMode === 'year') {
            matchesTime = qDate.getFullYear().toString() === filterYear
        }

        return matchesSearch && matchesBranch && matchesTime
    })

    const today = getLocalDate(new Date())

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
            {isModalOpen && (
                <QuotationModal
                    quotation={editingQuotation}
                    isSaving={isSaving}
                    currencySymbol={currencySymbol}
                    onClose={() => { setIsModalOpen(false); setEditingQuotation(null); }}
                    onSave={handleSave}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>Cotizaciones</h1>
                    <p style={{ opacity: 0.5, fontWeight: '500' }}>Gestión de proformas y presupuestos para clientes</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn" onClick={fetchQuotations} disabled={loading} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={() => { setEditingQuotation(null); setIsModalOpen(true); }} style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', fontWeight: '800', gap: '0.5rem' }}>
                        <Plus size={20} /> NUEVA COTIZACIÓN
                    </button>
                </div>
            </div>

            {/* Metrics Dashboard (Simplified for Quotes) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                {[
                    { label: 'Pendientes', val: filteredQuotations.filter(q => q.status === 'Pendiente').length, icon: <Clock size={24} />, bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)', trend: 'Por convertir' },
                    { label: 'Convertidas', val: filteredQuotations.filter(q => q.status === 'Convertido').length, icon: <CheckCircle size={24} />, bg: 'linear-gradient(135deg, #10b981, #34d399)', trend: 'Ventas cerradas' },
                    { label: 'Total Proyectado', val: `${currencySymbol}${filteredQuotations.filter(q => q.status === 'Pendiente').reduce((acc, q) => acc + (q.total || 0), 0).toLocaleString()}`, icon: <TrendingUp size={24} />, bg: 'linear-gradient(135deg, #6366f1, #818cf8)', trend: 'En negociación' },
                    { label: 'Transacciones', val: filteredQuotations.length, icon: <FileText size={24} />, bg: 'linear-gradient(135deg, #6b7280, #9ca3af)', trend: 'Citas totales' }
                ].map((m, i) => (
                    <div key={i} className="card shadow-md" style={{ background: m.bg, color: 'white', border: 'none', padding: '1.5rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, transform: 'rotate(-15deg)' }}>{m.icon}</div>
                        <p style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.05em', margin: 0 }}>{m.label}</p>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '900', margin: 0, letterSpacing: '-0.02em' }}>{m.val}</h2>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '6px', alignSelf: 'flex-start' }}>{m.trend}</span>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '24px', border: '1px solid hsl(var(--border) / 0.6)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, número de cotización..."
                        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '16px', border: 'none', fontSize: '0.95rem', outline: 'none' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 2, alignItems: 'center' }}>
                    <div style={{ minWidth: '180px' }}>
                        <select
                            style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                            value={filterBranchId}
                            onChange={(e) => setFilterBranchId(e.target.value)}
                        >
                            <option value="all">Todas las Sucursales</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <div style={{ width: '1px', height: '2rem', backgroundColor: 'hsl(var(--border) / 0.5)', margin: '0 0.5rem' }}></div>

                    <div style={{ display: 'flex', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '0.25rem', borderRadius: '12px', gap: '0.25rem' }}>
                        {['day', 'month', 'year'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setFilterMode(mode)}
                                style={{
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '10px',
                                    fontSize: '0.8rem',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    backgroundColor: filterMode === mode ? 'white' : 'transparent',
                                    color: filterMode === mode ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground) / 0.6)',
                                    boxShadow: filterMode === mode ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {mode === 'day' ? 'DÍA' : mode === 'month' ? 'MES' : 'AÑO'}
                            </button>
                        ))}
                    </div>

                    {filterMode === 'day' && (
                        <div style={{ minWidth: '150px' }}>
                            <input
                                type="date"
                                style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                value={filterDay}
                                onChange={(e) => setFilterDay(e.target.value)}
                            />
                        </div>
                    )}
                    {filterMode === 'month' && (
                        <>
                            <div style={{ minWidth: '120px' }}>
                                <select
                                    style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                >
                                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(m => (
                                        <option key={m} value={m}>{new Date(2024, m - 1).toLocaleString('es', { month: 'long' }).toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ minWidth: '100px' }}>
                                <select
                                    style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value)}
                                >
                                    {[2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                                </select>
                            </div>
                        </>
                    )}
                    {filterMode === 'year' && (
                        <div style={{ minWidth: '100px' }}>
                            <select
                                style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => {
                        setFilterBranchId('all');
                        setFilterMode('day');
                        setFilterDay(getLocalDate(new Date()));
                        setSearchTerm('');
                    }}
                    className="btn"
                    style={{ gap: '0.5rem', borderRadius: '12px', padding: '0.75rem 1.25rem', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}
                >
                    Limpiar
                </button>
            </div>

            {/* List */}
            <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.6)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                        <tr>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Número</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Cliente</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Sucursal</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Estado</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Fecha</th>
                            <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Total</th>
                            <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && quotations.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '6rem', textAlign: 'center' }}>
                                    <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.3 }} />
                                </td>
                            </tr>
                        ) : filteredQuotations.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '6rem', textAlign: 'center' }}>
                                    <div style={{ opacity: 0.2, marginBottom: '1rem' }}><FileText size={64} style={{ margin: '0 auto' }} /></div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', opacity: 0.4 }}>No hay cotizaciones encontradas</h3>
                                </td>
                            </tr>
                        ) : (
                            filteredQuotations.map(q => (
                                <tr key={q.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span style={{ fontWeight: '800', color: 'hsl(var(--primary))' }}>#{q.quotation_number}</span>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))' }}><User size={16} /></div>
                                            <span style={{ fontWeight: '700' }}>{q.customers?.name || 'Cliente General'}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.7 }}>
                                            <Building2 size={16} />
                                            <span>{q.branches?.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '0.75rem',
                                            fontWeight: '800',
                                            backgroundColor: q.status === 'Convertido' ? 'hsl(142 76% 36% / 0.1)' : 'hsl(var(--secondary))',
                                            color: q.status === 'Convertido' ? 'hsl(142 76% 36%)' : 'hsl(var(--secondary-foreground))'
                                        }}>
                                            {q.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{new Date(q.created_at).toLocaleDateString()}</span>
                                            <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>{new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                        <span style={{ fontSize: '1.1rem', fontWeight: '900' }}>{currencySymbol}{q.total?.toLocaleString()}</span>
                                    </td>
                                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                            {q.status === 'Pendiente' && (
                                                <button onClick={() => handleConvert(q)} className="btn btn-primary" style={{ padding: '0.5rem', borderRadius: '10px' }} title="Convertir a Venta"><ShoppingCart size={18} /></button>
                                            )}
                                            <button onClick={() => handlePrint(q)} className="btn" style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }} title="Imprimir"><Printer size={18} /></button>
                                            {q.status === 'Pendiente' && (
                                                <button onClick={() => { setEditingQuotation(q); setIsModalOpen(true); }} className="btn" style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.5)', color: 'hsl(var(--primary))' }} title="Editar"><Eye size={18} /></button>
                                            )}
                                            {q.status === 'Pendiente' && (
                                                <button onClick={() => handleVoid(q.id)} className="btn" style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--destructive) / 0.05)', color: 'hsl(var(--destructive))' }} title="Anular"><X size={18} /></button>
                                            )}
                                            {q.status !== 'Convertido' && (
                                                <button onClick={() => handleDelete(q.id)} className="btn" style={{ padding: '0.2rem', opacity: 0.3 }} title="Eliminar Permanentemente"><Trash2 size={14} /></button>
                                            )}
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
