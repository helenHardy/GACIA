import React, { useState, useEffect } from 'react'
import { 
    FileText, 
    Calendar, 
    Filter, 
    Download, 
    TrendingUp, 
    RefreshCw, 
    Building2, 
    DollarSign, 
    ShoppingBag, 
    ArrowRight,
    Search,
    ChevronRight,
    Package,
    PieChart,
    BarChart3,
    ArrowUpRight,
    Clock
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { utils, writeFile } from 'xlsx'

export default function Reports() {
    const [loading, setLoading] = useState(false)
    const [branches, setBranches] = useState([])
    const [sales, setSales] = useState([])
    const [summary, setSummary] = useState({
        totalRevenue: 0,
        totalSales: 0,
        avgTicket: 0,
        topBranch: 'N/A'
    })
    const [branchStats, setBranchStats] = useState([])
    
    // Filters
    const [period, setPeriod] = useState('day') // 'day', 'month', 'year'
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
    const [selectedBranchId, setSelectedBranchId] = useState('all')

    useEffect(() => {
        fetchInitialData()
    }, [])

    useEffect(() => {
        fetchReports()
    }, [period, selectedDate, selectedMonth, selectedYear, selectedBranchId])

    async function fetchInitialData() {
        const { data } = await supabase.from('branches').select('id, name').eq('active', true)
        setBranches(data || [])
    }

    async function fetchReports() {
        try {
            setLoading(true)
            let query = supabase.from('sales').select(`
                *,
                branches(name),
                customers(name)
            `)

            // Apply time filters
            if (period === 'day') {
                const date = new Date(selectedDate)
                const start = new Date(date.setHours(0,0,0,0)).toISOString()
                const end = new Date(date.setHours(23,59,59,999)).toISOString()
                query = query.gte('created_at', start).lte('created_at', end)
            } else if (period === 'month') {
                const start = new Date(selectedYear, selectedMonth - 1, 1).toISOString()
                const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59).toISOString()
                query = query.gte('created_at', start).lte('created_at', end)
            } else if (period === 'year') {
                const start = new Date(selectedYear, 0, 1).toISOString()
                const end = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString()
                query = query.gte('created_at', start).lte('created_at', end)
            }

            if (selectedBranchId !== 'all') {
                query = query.eq('branch_id', selectedBranchId)
            }

            const { data, error } = await query.order('created_at', { ascending: false })
            if (error) throw error

            setSales(data || [])
            calculateStats(data || [])
        } catch (err) {
            console.error('Error fetching reports:', err)
        } finally {
            setLoading(false)
        }
    }

    function calculateStats(data) {
        const totalRevenue = data.reduce((acc, s) => acc + Number(s.total), 0)
        const totalSales = data.length
        const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0

        // Group by branch
        const byBranch = {}
        data.forEach(s => {
            const bName = s.branches?.name || 'Desconocida'
            if (!byBranch[bName]) byBranch[bName] = { revenue: 0, count: 0, id: s.branch_id }
            byBranch[bName].revenue += Number(s.total)
            byBranch[bName].count += 1
        })

        const sortedBranches = Object.entries(byBranch).map(([name, stats]) => ({
            name,
            ...stats
        })).sort((a, b) => b.revenue - a.revenue)

        setBranchStats(sortedBranches)
        setSummary({
            totalRevenue,
            totalSales,
            avgTicket,
            topBranch: sortedBranches[0]?.name || 'N/A'
        })
    }

    const exportToExcel = () => {
        const reportData = sales.map(s => ({
            'ID Venta': s.sale_number || s.id.slice(0, 8),
            'Fecha': new Date(s.created_at).toLocaleString(),
            'Sucursal': s.branches?.name,
            'Cliente': s.customers?.name || 'Cliente General',
            'Metodo Pago': s.payment_method,
            'Total': s.total
        }))
        const ws = utils.json_to_sheet(reportData)
        const wb = utils.book_new()
        utils.book_append_sheet(wb, ws, "Ventas")
        writeFile(wb, `Reporte_Gacia_${period}_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-0.04em', margin: 0, background: 'linear-gradient(to right, #1a1a1a, #666)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Analítica Global
                    </h1>
                    <p style={{ opacity: 0.5, fontWeight: '500', fontSize: '1.1rem' }}>Rendimiento operativo y financiero del sistema</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={exportToExcel} className="btn" style={{ padding: '0.75rem 1.5rem', borderRadius: '16px', backgroundColor: '#10b981', color: 'white', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
                        <Download size={20} /> EXPORTAR EXCEL
                    </button>
                    <button onClick={fetchReports} disabled={loading} className="btn" style={{ padding: '0.75rem', borderRadius: '16px', backgroundColor: 'white', border: '1px solid #eee' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Premium Filters Section */}
            <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '28px', border: '1px solid rgba(0,0,0,0.05)', backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                
                <div style={{ display: 'flex', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.4rem', borderRadius: '18px', gap: '0.25rem' }}>
                    {['day', 'month', 'year'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                border: 'none',
                                padding: '0.6rem 1.5rem',
                                borderRadius: '14px',
                                fontSize: '0.85rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                backgroundColor: period === p ? 'white' : 'transparent',
                                color: period === p ? '#3b82f6' : '#666',
                                boxShadow: period === p ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                        >
                            {p === 'day' ? 'Diario' : p === 'month' ? 'Mensual' : 'Anual'}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                    {period === 'day' && (
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Calendar size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 3rem', borderRadius: '16px', border: '1px solid #eee', fontSize: '0.95rem', fontWeight: '600', outline: 'none' }}
                            />
                        </div>
                    )}

                    {period === 'month' && (
                        <>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '16px', border: '1px solid #eee', fontSize: '0.95rem', fontWeight: '600', outline: 'none' }}
                            >
                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                                    <option key={i+1} value={i+1}>{m}</option>
                                ))}
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '16px', border: '1px solid #eee', fontSize: '0.95rem', fontWeight: '600', outline: 'none' }}
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </>
                    )}

                    {period === 'year' && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '16px', border: '1px solid #eee', fontSize: '0.95rem', fontWeight: '600', outline: 'none' }}
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    )}
                </div>

                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Building2 size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                    <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 3rem', borderRadius: '16px', border: '1px solid #eee', fontSize: '0.95rem', fontWeight: '600', outline: 'none' }}
                    >
                        <option value="all">Todas las Sucursales</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
            </div>

            {/* KPI Overview Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
                {[
                    { label: 'Ingresos Totales', val: `Bs. ${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: <DollarSign size={24} />, bg: '#3b82f6' },
                    { label: 'Ventas Realizadas', val: summary.totalSales, icon: <ShoppingBag size={24} />, bg: '#10b981' },
                    { label: 'Ticket Promedio', val: `Bs. ${summary.avgTicket.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: <TrendingUp size={24} />, bg: '#8b5cf6' },
                    { label: 'Sucursal Líder', val: summary.topBranch, icon: <Building2 size={24} />, bg: '#f59e0b' }
                ].map((kpi, i) => (
                    <div key={i} className="card shadow-lg" style={{ padding: '2rem', borderRadius: '32px', position: 'relative', overflow: 'hidden', border: 'none', backgroundColor: 'white' }}>
                        <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: kpi.bg, opacity: 0.05 }}></div>
                        <div style={{ width: '48px', height: '48px', borderRadius: '16px', backgroundColor: kpi.bg + '15', color: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                            {kpi.icon}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '800', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</p>
                        <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.75rem', fontWeight: '900', letterSpacing: '-0.02em' }}>{kpi.val}</h2>
                    </div>
                ))}
            </div>

            {/* Branch Comparison & Trends */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                
                {/* Branch Comparative Table */}
                <div className="card shadow-sm" style={{ padding: '2rem', borderRadius: '32px', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900' }}>Comparativa entre Sucursales</h3>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>Por Ingresos</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {branchStats.map((b, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: i === 0 ? '#3b82f6' : '#eee' }}></div>
                                        <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{b.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '600', opacity: 0.5 }}>{b.count} ventas</span>
                                        <span style={{ fontWeight: '900' }}>Bs. {b.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                                <div style={{ height: '8px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${(b.revenue / summary.totalRevenue) * 100}%`, 
                                        backgroundColor: i === 0 ? '#3b82f6' : '#cbd5e1',
                                        borderRadius: '4px',
                                        transition: 'width 1s ease'
                                    }}></div>
                                </div>
                            </div>
                        ))}
                        {branchStats.length === 0 && (
                            <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.3 }}>
                                <BarChart3 size={48} style={{ margin: '0 auto 1rem' }} />
                                <p>No hay datos comparativos para este periodo</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Additional Insight Card */}
                <div className="card shadow-sm" style={{ padding: '2rem', borderRadius: '32px', border: '1px solid rgba(0,0,0,0.05)', background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        <PieChart size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem' }}>Resumen del Periodo</h3>
                    <p style={{ opacity: 0.6, fontSize: '0.9rem', lineHeight: '1.6' }}>
                        Durante este periodo {period === 'day' ? 'de hoy' : period === 'month' ? 'del mes' : 'del año'}, se han generado <strong>{summary.totalSales} transacciones</strong> con un flujo total de <strong>Bs. {summary.totalRevenue.toLocaleString()}</strong>.
                    </p>
                    <div style={{ marginTop: '2rem', padding: '1.5rem', borderRadius: '24px', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span style={{ opacity: 0.5 }}>Mejor Sucursal</span>
                            <span style={{ fontWeight: '800' }}>{summary.topBranch}</span>
                        </div>
                        <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                            <span style={{ opacity: 0.5 }}>Eficiencia</span>
                            <span style={{ color: '#10b981', fontWeight: '800' }}>+12.5%</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Detailed Transaction Log */}
            <div className="card shadow-sm" style={{ padding: 0, borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900' }}>Detalle de Transacciones Globales</h3>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#f1f5f9', padding: '4px 12px', borderRadius: '8px' }}>{sales.length} REGISTROS</span>
                    </div>
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f8fafc' }}>
                            <tr>
                                <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Referencia</th>
                                <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Sucursal</th>
                                <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Cliente</th>
                                <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Metodo</th>
                                <th style={{ padding: '1.25rem 2rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Hora</th>
                                <th style={{ padding: '1.25rem 2rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.4 }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(s => (
                                <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={{ padding: '1.25rem 2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <ShoppingBag size={14} style={{ opacity: 0.4 }} />
                                            </div>
                                            <span style={{ fontWeight: '700', color: '#3b82f6' }}>#{s.sale_number || s.id.slice(0, 8)}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 2rem', fontSize: '0.9rem', fontWeight: '600' }}>{s.branches?.name}</td>
                                    <td style={{ padding: '1.25rem 2rem', fontSize: '0.9rem', fontWeight: '600' }}>{s.customers?.name || 'Cliente General'}</td>
                                    <td style={{ padding: '1.25rem 2rem' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: '800', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#eee', textTransform: 'uppercase' }}>{s.payment_method}</span>
                                    </td>
                                    <td style={{ padding: '1.25rem 2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: 0.4, fontSize: '0.85rem' }}>
                                            <Clock size={12} />
                                            {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1.25rem 2rem', textAlign: 'right', fontWeight: '900', fontSize: '1rem' }}>
                                        Bs. {Number(s.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            {sales.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '6rem', textAlign: 'center' }}>
                                        <Search size={48} style={{ margin: '0 auto 1rem', opacity: 0.1 }} />
                                        <p style={{ opacity: 0.4, fontWeight: '700' }}>No se encontraron transacciones en este periodo</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
