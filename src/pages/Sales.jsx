import React, { useState, useEffect, useRef } from 'react'
import { Plus, Search, ClipboardList, RefreshCw, AlertTriangle, Building2, Calendar, User, Eye, Edit2, Trash2, ShoppingCart, TrendingUp, DollarSign, Target, Filter, ChevronRight, X, Printer, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SaleModal from '../components/pos/SaleModal'
import Ticket from '../components/pos/Ticket'


export default function Sales() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingSale, setEditingSale] = useState(null)
    const [isReadOnly, setIsReadOnly] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [currencySymbol, setCurrencySymbol] = useState('Bs.')
    const [saleForTicket, setSaleForTicket] = useState(null)
    const [branches, setBranches] = useState([])
    const [isAdmin, setIsAdmin] = useState(false)
    const [filterBranchId, setFilterBranchId] = useState('all')
    const [filterMode, setFilterMode] = useState('day') // 'day', 'month', 'year', 'range'
    const [filterDay, setFilterDay] = useState(new Date().toLocaleDateString('sv-SE'))
    const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString())
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
    const [filterStartDate, setFilterStartDate] = useState(new Date().toLocaleDateString('sv-SE'))
    const [filterEndDate, setFilterEndDate] = useState(new Date().toLocaleDateString('sv-SE'))
    const ticketRef = useRef()

    const getLocalDate = (date) => {
        if (!date) return ''
        const d = new Date(date)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }



    useEffect(() => {
        checkUserRole()
        fetchSales()
        fetchSettings()
        fetchBranches()

        const handleTicketEvent = (e) => handlePrint(e.detail)
        window.addEventListener('print-ticket', handleTicketEvent)
        return () => window.removeEventListener('print-ticket', handleTicketEvent)
    }, [])

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            setIsAdmin(data?.role === 'Administrador')
        }
    }

    useEffect(() => {
        const savedBranch = localStorage.getItem('sales_branch')
        const savedMode = localStorage.getItem('sales_mode')
        if (savedBranch) setFilterBranchId(savedBranch)
        if (savedMode) setFilterMode(savedMode)
    }, [])

    useEffect(() => {
        localStorage.setItem('sales_branch', filterBranchId)
        localStorage.setItem('sales_mode', filterMode)
    }, [filterBranchId, filterMode])

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

            // Set default selection
            if (data && data.length > 0) {
                if (filterBranchId === 'all' && !isUserAdmin) {
                    setFilterBranchId(data[0].id)
                } else if (!filterBranchId || (filterBranchId !== 'all' && !data.find(b => b.id === filterBranchId))) {
                    setFilterBranchId(data[0].id)
                }
            }
        } catch (err) {
            console.error('Error fetching branches:', err)
        }
    }


    async function fetchSettings() {
        const { data } = await supabase.from('settings').select('*')
        if (data) {
            const currency = data.find(s => s.key === 'currency')?.value
            if (currency === 'BOL') setCurrencySymbol('Bs.')
            else if (currency === 'EUR') setCurrencySymbol('€')
            else if (currency === 'USD') setCurrencySymbol('$')
        }
    }

    async function fetchSales() {
        try {
            setLoading(true)
            setError(null)
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    customers:customer_id (*),
                    branches:branch_id (*),
                    profiles:profiles!fk_sales_user (full_name)
                `)
                .order('created_at', { ascending: false })

            // Security: if not admin, restrict to assigned branches
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
                if (profile?.role !== 'Administrador') {
                    const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                    const assignedIds = assignments?.map(a => a.branch_id) || []
                    if (assignedIds.length > 0) {
                        query = query.in('branch_id', assignedIds)
                    } else {
                        setSales([])
                        setLoading(false)
                        return
                    }
                }
            }

            const { data, error } = await query

            if (error) throw error
            setSales(data || [])
        } catch (err) {
            console.error('Error fetching sales:', err)
            setError('Error al cargar el historial de ventas.')
        } finally {
            setLoading(false)
        }
    }



    const handlePrint = async (sale) => {
        try {
            setLoading(true)
            const { data: items } = await supabase.from('sale_items').select('*, products(name, sku)').eq('sale_id', sale.id)

            const formattedItems = items.map(i => ({
                ...i,
                name: i.products?.name,
                sku: i.products?.sku
            }))

            const ticketData = {
                sale: sale,
                items: formattedItems,
                branch: sale.branches,
                customer: sale.customers,
                paymentMethod: sale.payment_method,
                currencySymbol
            }

            setSaleForTicket(ticketData)

            // Wait for state to update and render before printing
            setTimeout(() => {
                const printArea = ticketRef.current.innerHTML
                const printWindow = window.open('', '_blank', 'width=800,height=600')
                printWindow.document.write(`<html><head><title>Ticket #${sale.sale_number}</title><style>body{margin:0;padding:0;}</style></head><body>${printArea}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script></body></html>`)
                printWindow.document.close()
            }, 100)
        } catch (err) {
            console.error(err)
            alert('Error al generar ticket')
        } finally {
            setLoading(false)
        }
    }


    const handleExportCSV = () => {
        try {
            if (filteredSales.length === 0) {
                alert('No hay datos para exportar')
                return
            }

            const headers = ['Orden,Cliente,NIT/CI,Sucursal,Vendedor,Fecha,Hora,Total']
            const rows = filteredSales.map(s => {
                const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`
                return [
                    escape(s.sale_number),
                    escape(s.customers?.name || 'Cliente General'),
                    escape(s.customers?.tax_id || ''),
                    escape(s.branches?.name),
                    escape(s.profiles?.full_name || 'Sistema'),
                    escape(new Date(s.created_at).toLocaleDateString()),
                    escape(new Date(s.created_at).toLocaleTimeString()),
                    s.total
                ].join(',')
            })

            const csvContent = [headers, ...rows].join('\n')
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.setAttribute('href', url)
            link.setAttribute('download', `ventas_export_${new Date().toLocaleDateString('sv-SE')}.csv`)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        } catch (err) {
            console.error('Error exporting CSV:', err)
            alert('Error al exportar datos')
        }
    }

    const handleEdit = async (sale, forceReadOnly = false) => {

        try {
            setLoading(true)
            const { data: items, error } = await supabase.from('sale_items').select('*, products(name, sku)').eq('sale_id', sale.id)
            if (error) throw error
            const formattedItems = items.map(i => ({
                product_id: i.product_id,
                name: i.products?.name,
                sku: i.products?.sku,
                quantity: i.quantity,
                price: i.price,
                total: i.total
            }))
            setEditingSale({ ...sale, items: formattedItems })
            setIsReadOnly(forceReadOnly || (!isAdmin && !sale.can_edit))
            setIsModalOpen(true)
        } catch (err) {
            console.error(err)
            alert('Error al cargar detalles de la venta')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (saleData) => {
        try {
            setIsSaving(true)
            const { items, ...header } = saleData
            const { data: { user } } = await supabase.auth.getUser()
            let targetSaleId = null

            if (editingSale) {
                targetSaleId = editingSale.id
                // Borramos los items anteriores. Los triggers se encargarán de devolver el stock (BEFORE DELETE)
                await supabase.from('sale_items').delete().eq('sale_id', targetSaleId)

                // Actualizamos la cabecera.
                await supabase.from('sales').update({
                    customer_id: header.customer_id,
                    branch_id: header.branch_id,
                    subtotal: header.subtotal,
                    tax: header.tax,
                    discount: header.discount,
                    total: header.total,
                    is_credit: header.is_credit,
                    user_id: user?.id
                }).eq('id', targetSaleId)
            } else {
                // Nueva venta.
                const { data: sale, error: sError } = await supabase.from('sales').insert([{ ...header, user_id: user?.id }]).select().single()
                if (sError) throw sError
                targetSaleId = sale.id
            }

            const itemsToSave = items.map(item => ({
                sale_id: targetSaleId, product_id: item.product_id, quantity: item.quantity, price: item.price, total: item.total
            }))
            // Al insertar, el trigger trg_kardex_sale_insert_update descontará el stock
            await supabase.from('sale_items').insert(itemsToSave)

            setIsModalOpen(false)
            setEditingSale(null)
            fetchSales()
        } catch (err) {
            console.error(err)
            alert('Error al procesar la venta: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleVoid = async (sale) => {
        if (!window.confirm(`¿Estás seguro de ANULAR la venta #${sale.sale_number}? Los productos volverán al stock.`)) return
        try {
            setLoading(true)
            // Al eliminar la venta, los triggers se encargarán de:
            // 1. Devolver el stock (Trigger BEFORE DELETE en sale_items via CASCADE)
            // 2. Revertir el crédito del cliente (Trigger AFTER DELETE en sales)
            const { error } = await supabase.from('sales').delete().eq('id', sale.id)
            if (error) throw error
            fetchSales()
        } catch (err) {
            console.error(err)
            alert('Error al anular venta: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    async function togglePermission(saleId, field, currentValue) {
        try {
            const { error } = await supabase
                .from('sales')
                .update({ [field]: !currentValue })
                .eq('id', saleId)

            if (error) throw error

            // Update local state instead of full re-fetch for better UX
            setSales(prev => prev.map(s => s.id === saleId ? { ...s, [field]: !currentValue } : s))
        } catch (err) {
            console.error('Error toggling permission:', err)
            alert('Error al actualizar permisos')
        }
    }

    const filteredSales = sales.filter(s => {
        const saleDate = new Date(s.created_at)
        const saleLocalDate = getLocalDate(s.created_at)

        const matchesSearch = (s.customers?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (s.sale_number?.toString() || '').includes(searchTerm) ||
            (s.id?.toString() || '').includes(searchTerm)

        const matchesBranch = filterBranchId === 'all' ||
            String(s.branch_id || '') === String(filterBranchId) ||
            String(s.branches?.id || '') === String(filterBranchId)

        let matchesTime = true
        if (filterMode === 'day') {
            matchesTime = saleLocalDate === filterDay
        } else if (filterMode === 'month') {
            matchesTime = (saleDate.getMonth() + 1).toString() === filterMonth && saleDate.getFullYear().toString() === filterYear
        } else if (filterMode === 'range') {
            matchesTime = saleLocalDate >= filterStartDate && saleLocalDate <= filterEndDate
        }

        return matchesSearch && matchesBranch && matchesTime
    })

    // Metrics calculation (based on global sales but with local time awareness)
    const today = getLocalDate(new Date())

    const salesToday = sales.filter(s => getLocalDate(s.created_at) === today)
    const totalToday = salesToday.reduce((acc, s) => acc + (s.total || 0), 0)

    // Average ticket based on filtered list to provide context to the current view
    const avgSale = filteredSales.length > 0 ? (filteredSales.reduce((acc, s) => acc + (s.total || 0), 0) / filteredSales.length) : 0

    const totalMonth = sales.filter(s => {
        const d = new Date(s.created_at)
        const now = new Date()
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).reduce((acc, s) => acc + (s.total || 0), 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
            {isModalOpen && (
                <SaleModal
                    initialData={editingSale}
                    isSaving={isSaving}
                    readOnly={isReadOnly}
                    currencySymbol={currencySymbol}
                    onClose={() => { setIsModalOpen(false); setEditingSale(null); setIsReadOnly(false); }}
                    onSave={handleSave}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>Historial de Ventas</h1>
                    <p style={{ opacity: 0.5, fontWeight: '500' }}>Gestión integral de transacciones y facturación</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn" onClick={fetchSales} disabled={loading} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn" onClick={handleExportCSV} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }} title="Exportar CSV">
                        <Download size={20} />
                    </button>
                    <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={() => { setEditingSale(null); setIsModalOpen(true); }} style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', fontWeight: '800', gap: '0.5rem' }}>
                        <Plus size={20} /> NUEVA VENTA
                    </button>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                {[
                    { label: 'Total Filtrado', val: `${currencySymbol}${filteredSales.reduce((acc, s) => acc + (s.total || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: <TrendingUp size={24} />, bg: 'linear-gradient(135deg, hsl(142 76% 36%), hsl(142 70% 45%))', trend: `Sumatoria actual` },
                    { label: 'Ventas Hoy (Gral)', val: `${currencySymbol}${sales.filter(s => new Date(s.created_at).toLocaleDateString('sv-SE') === today).reduce((acc, s) => acc + (s.total || 0), 0).toFixed(0)}`, icon: <Target size={24} />, bg: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))', trend: 'Total global' },
                    { label: 'Ticket Promedio', val: `${currencySymbol}${filteredSales.length > 0 ? (filteredSales.reduce((acc, s) => acc + (s.total || 0), 0) / filteredSales.length).toFixed(0) : 0}`, icon: <DollarSign size={24} />, bg: 'linear-gradient(135deg, #6366f1, #818cf8)', trend: 'De lo filtrado' },
                    { label: 'Transacciones', val: filteredSales.length, icon: <ClipboardList size={24} />, bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)', trend: 'Resultados encontrados' }
                ].map((m, i) => (

                    <div key={i} className="card shadow-md" style={{ background: m.bg, color: 'white', border: 'none', padding: '1.5rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, transform: 'rotate(-15deg)' }}>{m.icon}</div>
                        <p style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.05em', margin: 0 }}>{m.label}</p>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '900', margin: 0, letterSpacing: '-0.02em' }}>{m.val}</h2>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '6px', alignSelf: 'flex-start' }}>{m.trend}</span>
                    </div>
                ))}
            </div>

            <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '24px', border: '1px solid hsl(var(--border) / 0.6)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, número de venta o ID..."
                        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '16px', border: 'none', fontSize: '0.95rem', outline: 'none' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 2, alignItems: 'center' }}>
                    {/* Sucursal Filter */}
                    <div style={{ minWidth: '180px' }}>
                        <select
                            disabled={branches.length <= 1 && !isAdmin}
                            style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                            value={filterBranchId}
                            onChange={(e) => setFilterBranchId(e.target.value)}
                        >
                            {isAdmin && <option value="all">Todas las Sucursales</option>}
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <div style={{ width: '1px', height: '2rem', backgroundColor: 'hsl(var(--border) / 0.5)', margin: '0 0.5rem' }}></div>

                    {/* Mode Selector */}
                    <div style={{ display: 'flex', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '0.25rem', borderRadius: '12px', gap: '0.25rem' }}>
                        {['day', 'month', 'year', 'range'].map(mode => (
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
                                {mode === 'day' ? 'DÍA' : mode === 'month' ? 'MES' : mode === 'year' ? 'AÑO' : 'RANGO'}
                            </button>
                        ))}
                    </div>

                    <div style={{ width: '1px', height: '2rem', backgroundColor: 'hsl(var(--border) / 0.5)', margin: '0 0.5rem' }}></div>

                    {/* Dynamic Filters based on Mode */}
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
                            <div style={{ minWidth: '150px' }}>
                                <select
                                    style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    value={filterMonth}
                                    onChange={(e) => setFilterMonth(e.target.value)}
                                >
                                    {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                                        <option key={i} value={(i + 1).toString()}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ minWidth: '100px' }}>
                                <select
                                    style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value)}
                                >
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y.toString()}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    {filterMode === 'year' && (
                        <div style={{ minWidth: '120px' }}>
                            <select
                                style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y.toString()}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {filterMode === 'range' && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="date"
                                style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                            />
                            <span style={{ fontWeight: '800', opacity: 0.5 }}>-</span>
                            <input
                                type="date"
                                style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                value={filterEndDate}
                                onChange={(e) => setFilterEndDate(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                <button
                    onClick={() => {
                        setFilterBranchId('all');
                        setFilterMode('day');
                        setFilterDay(getLocalDate(new Date()));
                        setFilterMonth((new Date().getMonth() + 1).toString());
                        setFilterYear(new Date().getFullYear().toString());
                        setSearchTerm('');
                    }}
                    className="btn"
                    style={{ gap: '0.5rem', borderRadius: '12px', padding: '0.75rem 1.25rem', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}
                >
                    Limpiar
                </button>
            </div>


            <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.6)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                        <tr>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Orden</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Cliente</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Sucursal</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Vendedor</th>
                            <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Fecha</th>
                            <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Total</th>
                            <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && sales.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '6rem', textAlign: 'center' }}>
                                    <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.3 }} />
                                </td>
                            </tr>
                        ) : filteredSales.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ padding: '6rem', textAlign: 'center' }}>
                                    <div style={{ opacity: 0.2, marginBottom: '1rem' }}><ShoppingCart size={64} style={{ margin: '0 auto' }} /></div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', opacity: 0.4 }}>No hay ventas registradas</h3>
                                    <p style={{ opacity: 0.3, fontSize: '0.9rem' }}>Realiza tu primera venta en el punto de venta.</p>
                                </td>
                            </tr>
                        ) : (
                            filteredSales.map(s => (
                                <tr key={s.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: '800', color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.08)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.85rem' }}>
                                            #{s.sale_number || s.id.slice(0, 8)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--primary))' }}><User size={16} /></div>
                                            <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{s.customers?.name || 'Cliente General'}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.7 }}>
                                            <Building2 size={16} />
                                            <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{s.branches?.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '700', opacity: 0.6 }}>{s.profiles?.full_name?.split(' ')[0] || 'Sistema'}</span>
                                    </td>
                                    <td style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{new Date(s.created_at).toLocaleDateString()}</span>
                                            <span style={{ fontSize: '0.75rem', opacity: 0.4, fontWeight: '600' }}>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                        <span style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '-0.02em' }}>{currencySymbol}{s.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </td>
                                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                                            {/* Admin: Unlock controls */}
                                            {isAdmin && (
                                                <div style={{ display: 'flex', gap: '0.25rem', marginRight: '0.75rem', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '4px', borderRadius: '10px', border: '1px solid hsl(var(--border) / 0.3)' }}>
                                                    <button
                                                        onClick={() => togglePermission(s.id, 'can_edit', s.can_edit)}
                                                        className="btn-icon"
                                                        title={s.can_edit ? "Bloquear Edición" : "Habilitar Edición"}
                                                        style={{
                                                            padding: '6px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            backgroundColor: s.can_edit ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                                                            color: s.can_edit ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.3)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => togglePermission(s.id, 'can_void', s.can_void)}
                                                        className="btn-icon"
                                                        title={s.can_void ? "Bloquear Anulación" : "Habilitar Anulación"}
                                                        style={{
                                                            padding: '6px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            backgroundColor: s.can_void ? 'hsl(var(--destructive) / 0.15)' : 'transparent',
                                                            color: s.can_void ? 'hsl(var(--destructive))' : 'hsl(var(--foreground) / 0.3)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}

                                            <button onClick={() => handlePrint(s)} className="btn" style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.5)', color: 'hsl(var(--foreground))' }} title="Imprimir Ticket"><Printer size={18} /></button>

                                            {(isAdmin || s.can_edit) ? (
                                                <button onClick={() => handleEdit(s, false)} className="btn" style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.5)', color: 'hsl(var(--primary))' }} title="Modificar"><Edit2 size={18} /></button>
                                            ) : (
                                                <button onClick={() => handleEdit(s, true)} className="btn" style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.2)', color: 'hsl(var(--foreground) / 0.3)' }} title="Ver Detalles"><Eye size={18} /></button>
                                            )}

                                            {(isAdmin || s.can_void) && (
                                                <button onClick={() => handleVoid(s)} className="btn" style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'hsl(var(--destructive) / 0.05)', color: 'hsl(var(--destructive))' }} title="Anular"><Trash2 size={18} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Hidden Ticket reference for printing */}
            <div style={{ display: 'none' }}>
                {saleForTicket && (
                    <Ticket
                        ref={ticketRef}
                        sale={saleForTicket.sale}
                        items={saleForTicket.items}
                        branch={saleForTicket.branch}
                        customer={saleForTicket.customer}
                        paymentMethod={saleForTicket.paymentMethod}
                        currencySymbol={saleForTicket.currencySymbol}
                    />
                )}
            </div>
        </div>

    )
}
