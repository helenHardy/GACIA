import React, { useState, useEffect } from 'react'
import { FileText, Calendar, Filter, Download, ChevronDown, DollarSign, Package, TrendingUp, BarChart3, PieChart, RefreshCw, ArrowUpRight, ArrowDownRight, CreditCard, ShoppingBag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SalesChart from '../components/dashboard/SalesChart'

// Helper for date formatting
const formatDate = (date) => date.toISOString().split('T')[0]

export default function Reports() {
    // Filters State
    const [dateRange, setDateRange] = useState('7days') // 'today', '7days', '30days', 'thisMonth', 'custom'
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return formatDate(d)
    })
    const [endDate, setEndDate] = useState(() => formatDate(new Date()))
    const [selectedBranch, setSelectedBranch] = useState('all')

    // Data State
    const [loading, setLoading] = useState(false)
    const [branches, setBranches] = useState([])
    const [reportData, setReportData] = useState(null)
    const [activeTab, setActiveTab] = useState('sales') // 'sales', 'products', 'inventory'

    // User Role State
    const [isAdmin, setIsAdmin] = useState(false)

    useEffect(() => {
        checkUserRole()
        fetchBranches()
    }, [])

    useEffect(() => {
        // When date range preset changes, update start/end dates
        const end = new Date()
        const start = new Date()

        switch (dateRange) {
            case 'today':
                // start is today
                break;
            case '7days':
                start.setDate(end.getDate() - 7)
                break;
            case '30days':
                start.setDate(end.getDate() - 30)
                break;
            case 'thisMonth':
                start.setDate(1)
                break;
            case 'lastMonth':
                start.setMonth(start.getMonth() - 1)
                start.setDate(1)
                end.setDate(0) // last day of prev month
                break;
            case 'custom':
                return; // Do not touch custom dates
        }

        setStartDate(formatDate(start))
        setEndDate(formatDate(end))
    }, [dateRange])

    useEffect(() => {
        if (startDate && endDate) {
            fetchReportData()
        }
    }, [startDate, endDate, selectedBranch, activeTab])

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            setIsAdmin(data?.role === 'Administrador')
            if (data?.role !== 'Administrador') {
                // Fetch assigned branch to set default
                const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id).single()
                if (assignments) setSelectedBranch(assignments.branch_id)
            }
        }
    }

    async function fetchBranches() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            const isUserAdmin = profile?.role === 'Administrador'

            let query = supabase.from('branches').select('*').order('name')

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
                // If previously selected 'all' but now restricted, or nothing selected
                if (selectedBranch === 'all' && !isUserAdmin) {
                    setSelectedBranch(data[0].id)
                } else if (!selectedBranch || (selectedBranch !== 'all' && !data.find(b => b.id === selectedBranch))) {
                    setSelectedBranch(data[0].id)
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error)
        }
    }

    async function fetchReportData() {
        setLoading(true)
        setReportData(null)
        try {
            const branchParam = selectedBranch === 'all' ? null : selectedBranch

            if (activeTab === 'sales') {
                const { data, error } = await supabase.rpc('get_sales_report', {
                    p_start_date: startDate,
                    p_end_date: endDate,
                    p_branch_id: branchParam
                })

                if (error) throw error

                // Format for Chart
                const chartData = (data || []).map(item => ({
                    date: item.report_date,
                    total: item.total_sales,
                    label: new Date(item.report_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
                }))

                // Calculate Totals
                const summary = (data || []).reduce((acc, curr) => ({
                    sales: acc.sales + curr.total_sales,
                    profit: acc.profit + curr.total_profit,
                    tx: acc.tx + curr.transaction_count
                }), { sales: 0, profit: 0, tx: 0 })

                setReportData({ chart: chartData, summary, raw: data })

            } else if (activeTab === 'products') {
                const { data, error } = await supabase.rpc('get_top_products', {
                    p_start_date: startDate,
                    p_end_date: endDate,
                    p_branch_id: branchParam,
                    p_limit: 10
                })
                if (error) throw error
                setReportData(data)

            } else if (activeTab === 'inventory') {
                const { data, error } = await supabase.rpc('get_inventory_valuation', {
                    p_branch_id: branchParam
                })
                if (error) throw error
                setReportData(data && data.length > 0 ? data[0] : null)
            }
        } catch (error) {
            console.error('Error fetching reports:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '3rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.03em', color: 'hsl(var(--foreground))' }}>Reportes</h1>
                    <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '1rem' }}>Analítica detallada y métricas de rendimiento.</p>
                </div>
                <button
                    className="btn"
                    onClick={fetchReportData}
                    disabled={loading}
                    style={{ backgroundColor: 'white', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', padding: '0.6rem 1rem', fontWeight: '600' }}
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} style={{ marginRight: '0.5rem' }} />
                    Actualizar
                </button>
            </div>

            {/* Filters Bar */}
            <div className="card" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Branch Filter */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: 'hsl(var(--muted-foreground))' }}>Sucursal</label>
                    <div style={{ position: 'relative' }}>
                        <Filter size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }} />
                        <select
                            className="btn"
                            disabled={branches.length <= 1 && !isAdmin}
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            style={{ width: '100%', paddingLeft: '2.5rem', justifyContent: 'space-between', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                        >
                            {isAdmin && <option value="all">Todas las Sucursales</option>}
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Date Range Preset */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: 'hsl(var(--muted-foreground))' }}>Rango</label>
                    <div style={{ position: 'relative' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }} />
                        <select
                            className="btn"
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            style={{ width: '100%', paddingLeft: '2.5rem', justifyContent: 'space-between', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                        >
                            <option value="today">Hoy</option>
                            <option value="7days">Últimos 7 Días</option>
                            <option value="30days">Últimos 30 Días</option>
                            <option value="thisMonth">Este Mes</option>
                            <option value="lastMonth">Mes Anterior</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                </div>

                {/* Custom Date Inputs (only if custom) */}
                {dateRange === 'custom' && (
                    <>
                        <div style={{ flex: 0.5, minWidth: '140px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem' }}>Desde</label>
                            <input
                                type="date"
                                className="btn"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ width: '100%', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                            />
                        </div>
                        <div style={{ flex: 0.5, minWidth: '140px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem' }}>Hasta</label>
                            <input
                                type="date"
                                className="btn"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ width: '100%', backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '0.5rem' }}>
                <button
                    onClick={() => setActiveTab('sales')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        fontWeight: '600',
                        backgroundColor: activeTab === 'sales' ? 'hsl(var(--primary))' : 'transparent',
                        color: activeTab === 'sales' ? 'white' : 'hsl(var(--muted-foreground))',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <DollarSign size={18} /> Ventas y Finanzas
                </button>
                <button
                    onClick={() => setActiveTab('products')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        fontWeight: '600',
                        backgroundColor: activeTab === 'products' ? 'hsl(var(--primary))' : 'transparent',
                        color: activeTab === 'products' ? 'white' : 'hsl(var(--muted-foreground))',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <Package size={18} /> Productos Top
                </button>
                <button
                    onClick={() => setActiveTab('inventory')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        fontWeight: '600',
                        backgroundColor: activeTab === 'inventory' ? 'hsl(var(--primary))' : 'transparent',
                        color: activeTab === 'inventory' ? 'white' : 'hsl(var(--muted-foreground))',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <BarChart3 size={18} /> Inventario Valorizado
                </button>
            </div>

            {/* Content Area */}
            {/* Content Area */}
            {activeTab === 'sales' && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ padding: '1rem', borderRadius: '14px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                                <DollarSign size={28} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: '600' }}>Ventas Totales</p>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                                    Bs. {reportData?.summary?.sales?.toLocaleString('es-BO', { minimumFractionDigits: 2 }) || '0.00'}
                                </h3>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ padding: '1rem', borderRadius: '14px', backgroundColor: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 36%)' }}>
                                <TrendingUp size={28} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: '600' }}>Ganancia Estimada</p>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                                    Bs. {reportData?.summary?.profit?.toLocaleString('es-BO', { minimumFractionDigits: 2 }) || '0.00'}
                                </h3>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ padding: '1rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)', color: 'hsl(var(--foreground))' }}>
                                <ShoppingBag size={28} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: '600' }}>Transacciones</p>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                                    {reportData?.summary?.tx || '0'}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* Chart Section */}
                    <div className="card" style={{ padding: '2rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'Bold', marginBottom: '2rem' }}>Tendencia de Ingresos</h3>
                        <SalesChart data={reportData?.chart || []} />
                    </div>
                </div>
            )}

            {activeTab === 'products' && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid hsl(var(--border))' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Top 10 Productos Más Vendidos</h3>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--secondary) / 0.2)' }}>
                                        <th style={{ padding: '1rem 2rem', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'hsl(var(--muted-foreground))' }}>Producto</th>
                                        <th style={{ padding: '1rem 2rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '700', color: 'hsl(var(--muted-foreground))' }}>Unidades Vendidas</th>
                                        <th style={{ padding: '1rem 2rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '700', color: 'hsl(var(--muted-foreground))' }}>Ingresos Generados</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData && reportData.length > 0 ? (
                                        reportData.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                                                <td style={{ padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'hsl(var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                        {item.image_url ? (
                                                            <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <Package size={20} opacity={0.5} />
                                                        )}
                                                    </div>
                                                    <span style={{ fontWeight: '600' }}>{item.product_name}</span>
                                                </td>
                                                <td style={{ padding: '1rem 2rem', textAlign: 'right', fontWeight: '600' }}>{item.quantity_sold}</td>
                                                <td style={{ padding: '1rem 2rem', textAlign: 'right', fontWeight: '700', color: 'hsl(var(--primary))' }}>
                                                    Bs. {item.total_revenue.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="3" style={{ padding: '3rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                                                No hay datos disponibles para el periodo seleccionado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'inventory' && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid hsl(var(--primary))' }}>
                            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: '700', textTransform: 'uppercase' }}>Valor Total (Precio Venta)</p>
                            <h3 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'hsl(var(--foreground))' }}>
                                Bs. {reportData?.total_retail_value?.toLocaleString('es-BO', { minimumFractionDigits: 2 }) || '0.00'}
                            </h3>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Valor potencial de venta de todo el stock.</p>
                        </div>

                        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '4px solid hsl(var(--secondary-foreground))' }}>
                            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: '700', textTransform: 'uppercase' }}>Valor Total (Costo)</p>
                            <h3 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'hsl(var(--foreground))' }}>
                                Bs. {reportData?.total_cost_value?.toLocaleString('es-BO', { minimumFractionDigits: 2 }) || '0.00'}
                            </h3>
                            <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>Costo de adquisición del inventario actual.</p>
                        </div>

                        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                <div style={{ padding: '0.75rem', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary))' }}><Package size={24} /></div>
                                <div>
                                    <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', fontWeight: '700' }}>Productos Únicos</p>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{reportData?.item_count || 0}</h3>
                                </div>
                            </div>
                            <div style={{ height: '1px', backgroundColor: 'hsl(var(--border))', width: '100%' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', fontWeight: '600' }}>
                                <span>Margen Potencial</span>
                                <span style={{ color: 'hsl(var(--primary))' }}>
                                    {reportData?.total_cost_value > 0
                                        ? (((reportData.total_retail_value - reportData.total_cost_value) / reportData.total_retail_value) * 100).toFixed(1) + '%'
                                        : '0%'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '3rem', textAlign: 'center', opacity: 0.7 }}>
                        <p>Los reportes de inventario muestran el estado <strong>actual</strong> y no se afectan por el filtro de fechas.</p>
                    </div>
                </div>
            )}

        </div>
    )
}
